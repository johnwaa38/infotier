import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { randomUUID, createHash, createHmac } from 'crypto';
import { Client } from 'minio';
import { StubOcr, StubFace, OcrProvider, FaceProvider } from '../providers';
import { GoogleVisionProvider } from '../providers/googleVision.provider';
import { AzureFaceProvider } from '../providers/azureFace.provider';
import { DecisionService } from './decision.service';
import fetch from 'node-fetch';

@Injectable()
export class VerificationsService {
  private s3: Client;
  private ocr: OcrProvider;
  private face: FaceProvider;

  constructor(private prisma: PrismaService, private decision: DecisionService) {
    const useAws = process.env.USE_AWS_S3 === 'true';
    if (useAws) {
      this.s3 = new Client({
        endPoint: process.env.AWS_S3_ENDPOINT || 's3.amazonaws.com',
        port: parseInt(process.env.AWS_S3_PORT || '443'),
        useSSL: true,
        accessKey: process.env.AWS_ACCESS_KEY_ID || '',
        secretKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      });
    } else {
      this.s3 = new Client({
        endPoint: process.env.S3_ENDPOINT || 'storage',
        port: parseInt(process.env.S3_PORT || '9000'),
        useSSL: process.env.S3_USE_SSL === 'true',
        accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
      });
    }
    this.ocr  = (process.env.USE_GOOGLE_VISION === 'true') ? new GoogleVisionProvider() : new StubOcr();
    this.face = (process.env.USE_AZURE_FACE === 'true') ? new AzureFaceProvider()   : new StubFace();
  }

  private async ensureBucket() {
    const bucket = process.env.S3_BUCKET || 'infotier-evidence';
    const exists = await this.s3.bucketExists(bucket).catch(() => false);
    if (!exists) await this.s3.makeBucket(bucket);
    return bucket;
  }

  async createVerification(data: { customerId: string; userReference: string; idType: string; files: Array<{ field: string; buffer: Buffer; mime: string; }> }) {
    const bucket = await this.ensureBucket();
    const verificationId = `verif_${randomUUID()}`;

    await this.prisma.verification.create({ data: { id: verificationId, customerId: data.customerId, userReference: data.userReference, idType: data.idType, status: 'pending' } });

    let selfieBuf: Buffer | undefined;
    for (const f of data.files) {
      const object = `${verificationId}/${f.field}_${randomUUID()}`;
      const checksum = createHash('sha256').update(f.buffer).digest('hex');
      await this.s3.putObject(bucket, object, f.buffer, { 'Content-Type': f.mime });
      await this.prisma.evidence.create({ data: { verificationId, s3Path: object, mime: f.mime, checksum } });
      if (f.field === 'selfie') selfieBuf = f.buffer;
    }

    setTimeout(async () => {
      const v   = await this.prisma.verification.findUnique({ where: { id: verificationId } });
      const cfg = await this.prisma.customerConfig.findUnique({ where: { customerId: v?.customerId || '' } }).catch(() => null);
      const approve = cfg?.approveThreshold ?? 0.75;
      const reject  = cfg?.rejectThreshold  ?? 0.35;

      const evs = await this.prisma.evidence.findMany({ where: { verificationId } });
      const front = evs.find(e => e.s3Path.includes('id_front')) || evs[0];
      const frontBuf = front ? await this.getObjectBuffer(front.s3Path) : Buffer.from('');
      const ocrRes  = await this.ocr.extract(frontBuf);
      const faceRes = await this.face.compare(selfieBuf || Buffer.from(''));

      const decision = this.decision.decide({ ocrConf: ocrRes.confidence, matchScore: faceRes.matchScore, liveness: faceRes.liveness, approve, reject });

      await this.prisma.verification.update({ where: { id: verificationId }, data: { status: decision.status, score: decision.score, decisionReason: decision.reason, ocrData: { text: ocrRes.text, confidence: ocrRes.confidence }, completedAt: new Date() } });
      await this.prisma.auditLog.create({ data: { verificationId, action: 'auto_decision', actor: 'system', meta: { decision, ocr: ocrRes, face: faceRes } } });
      await this.notifyWebhook(verificationId, 'auto_decision');
    }, 1200);

    return { verification_id: verificationId, status: 'pending' };
  }

  private async notifyWebhook(verificationId: string, action: string) {
    try {
      const v = await this.prisma.verification.findUnique({ where: { id: verificationId } });
      if (!v) return;
      const cfg = await this.prisma.customerConfig.findUnique({ where: { customerId: v.customerId } });
      const url = cfg?.webhookUrl;
      if (!url) return;
      const payload = { id: v.id, status: v.status, score: v.score, reason: v.decisionReason, action };
      const body = JSON.stringify(payload);
      const secret = process.env.WEBHOOK_SECRET || '';
      const sig = secret ? 'sha256=' + createHmac('sha256', secret).update(body).digest('hex') : '';
      const headers: any = { 'Content-Type': 'application/json' };
      if (sig) headers['X-Infotier-Signature'] = sig;
      await fetch(url, { method: 'POST', headers, body }).catch(()=>{});
    } catch {}
  }

  private async getObjectBuffer(key: string) {
    const bucket = process.env.S3_BUCKET || 'infotier-evidence';
    const stream: any = await this.s3.getObject(bucket, key);
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  list() { return this.prisma.verification.findMany({ orderBy: { createdAt: 'desc' } }); }
  get(id: string) { return this.prisma.verification.findUnique({ where: { id } }); }

  async manualDecision(id: string, action: 'approved'|'rejected', actor='admin') {
    const v = await this.prisma.verification.update({ where: { id }, data: { status: action, decisionReason: `Manual ${action} by ${actor}`, completedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { verificationId: id, action: `manual_${action}`, actor, meta: {} } });
    await this.notifyWebhook(id, `manual_${action}`);
    return v;
  }
  async logs(id: string) { return this.prisma.auditLog.findMany({ where: { verificationId: id }, orderBy: { createdAt: 'desc' } }); }
}
