import { BadRequestException, Controller, Headers, Post, RawBodyRequest, Req, ServiceUnavailableException } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { Public } from '../auth/public.decorator';

@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Post('stripe')
  async stripe(@Req() request: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey || !webhookSecret) throw new ServiceUnavailableException('Stripe webhook is not configured');
    if (!signature || !request.rawBody) throw new BadRequestException('Missing webhook signature');
    const stripe = new Stripe(secretKey);
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret); }
    catch { throw new BadRequestException('Invalid webhook signature'); }
    if (!['identity.verification_session.verified', 'identity.verification_session.requires_input', 'identity.verification_session.canceled'].includes(event.type)) {
      return { received: true, ignored: true };
    }
    const session = event.data.object as Stripe.Identity.VerificationSession;
    const verificationId = session.metadata?.infotierVerificationId;
    if (!verificationId) return { received: true, ignored: true };
    const status = event.type.endsWith('.verified') ? 'approved' : event.type.endsWith('.requires_input') ? 'requires_input' : 'canceled';
    await this.prisma.$transaction([
      this.prisma.verification.update({
        where: { id: verificationId },
        data: { status, completedAt: status === 'approved' ? new Date() : null, decisionReason: `stripe:${event.type}` },
      }),
      this.prisma.auditLog.create({
        data: { verificationId, action: status, actor: 'stripe', meta: { eventId: event.id, providerSessionId: session.id } },
      }),
    ]);
    return { received: true };
  }

  @Public()
  @Post('didit')
  async didit(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-signature-v2') signatureV2?: string,
    @Headers('x-signature') signatureRaw?: string,
    @Headers('x-signature-simple') signatureSimple?: string,
    @Headers('x-timestamp') timestamp?: string,
  ) {
    const secret = process.env.DIDIT_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('Didit webhook is not configured');
    if (!request.rawBody || !timestamp || !this.fresh(timestamp)) throw new BadRequestException('Invalid webhook timestamp');
    const raw = request.rawBody;
    let body: Record<string, any>;
    try { body = JSON.parse(raw.toString('utf8')); }
    catch { throw new BadRequestException('Invalid JSON body'); }
    const verified =
      (signatureRaw && this.matches(signatureRaw, createHmac('sha256', secret).update(raw).digest('hex'))) ||
      (signatureV2 && this.matches(signatureV2, createHmac('sha256', secret).update(JSON.stringify(this.sortKeys(body)), 'utf8').digest('hex'))) ||
      (signatureSimple && this.matches(signatureSimple, createHmac('sha256', secret).update([body.timestamp ?? '', body.session_id ?? '', body.status ?? '', body.webhook_type ?? ''].join(':')).digest('hex')));
    if (!verified) {
      throw new BadRequestException('Invalid webhook signature');
    }
    if (!body.event_id || !body.webhook_type) throw new BadRequestException('Missing event identity');
    const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId: body.event_id } });
    if (existing) return { received: true, duplicate: true };
    await this.prisma.webhookEvent.create({ data: { eventId: body.event_id, webhookType: body.webhook_type, sessionId: body.session_id || body.business_session_id, status: body.status } });
    if (!['status.updated', 'data.updated'].includes(body.webhook_type) || !body.session_id) return { received: true, stored: true };
    const status = String(body.status || '').trim().toLowerCase().replace(/\s+/g, '_');
    const verification = await this.prisma.verification.findUnique({ where: { providerSessionId: body.session_id } });
    if (!verification) return { received: true, stored: true };
    const scores = [...(body.decision?.liveness_checks || []), ...(body.decision?.face_matches || [])]
      .map((x: any) => Number(x.score)).filter(Number.isFinite);
    const score = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length / 100 : undefined;
    await this.prisma.$transaction([
      this.prisma.verification.update({
        where: { id: verification.id },
        data: { status, score, completedAt: ['approved', 'declined'].includes(status) ? new Date() : null, decisionReason: `didit:${body.webhook_type}` },
      }),
      this.prisma.auditLog.create({
        data: { verificationId: verification.id, action: status, actor: 'didit', meta: { eventId: body.event_id, providerSessionId: body.session_id } },
      }),
    ]);
    return { received: true };
  }

  private fresh(timestamp: string) {
    const ts = Number(timestamp);
    return Number.isFinite(ts) && Math.abs(Math.floor(Date.now() / 1000) - ts) <= 300;
  }

  private matches(signature: string, expected: string) {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private sortKeys(value: any): any {
    if (Array.isArray(value)) return value.map(v => this.sortKeys(v));
    if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => ({ ...out, [key]: this.sortKeys(value[key]) }), {});
    return value;
  }
}
