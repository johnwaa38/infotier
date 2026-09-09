import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { evaluateSentinel } from './sentinel';

@Injectable()
export class OperationsService {
  private readonly startedAt = new Date();

  constructor(private readonly prisma: PrismaService) {}

  async status() {
    const checkedAt = new Date();
    let database: 'connected' | 'unavailable' = 'connected';
    try { await this.prisma.$queryRaw`SELECT 1`; } catch { database = 'unavailable'; }

    const since = new Date(checkedAt.getTime() - 86_400_000);
    const [webhookEvents24h, verificationCounts] = database === 'connected'
      ? await Promise.all([
          this.prisma.webhookEvent.count({ where: { createdAt: { gte: since } } }),
          this.prisma.verification.groupBy({ by: ['status'], _count: { _all: true } }),
        ])
      : [null, []];

    const sentinel = evaluateSentinel({
      database,
      diditConfigured: Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID && process.env.DIDIT_WEBHOOK_SECRET),
      adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
      jwtSecretConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
      ephemeralEvidenceStorage: !process.env.S3_BUCKET,
    });

    return {
      watchdog: {
        state: database === 'connected' ? 'reporting' : 'alert',
        startedAt: this.startedAt.toISOString(),
        checkedAt: checkedAt.toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      sentinel,
      dependencies: {
        database,
        didit: sentinel.issues.some(issue => issue.code === 'didit_incomplete') ? 'incomplete' : 'configured',
      },
      activity: { webhookEvents24h, verificationsByStatus: verificationCounts.map(row => ({ status: row.status, count: row._count._all })) },
      controls: {
        webhookSignatureVerification: true,
        webhookReplayWindowSeconds: 300,
        webhookAtomicIdempotency: true,
        adminAuthentication: true,
      },
    };
  }
}
