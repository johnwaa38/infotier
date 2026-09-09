import { BadRequestException, Controller, Get, Headers, Post, Query, RawBodyRequest, Redirect, Req, ServiceUnavailableException } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '../common/prisma.service';
import { Public } from '../auth/public.decorator';
import { verifyDiditWebhook } from './didit-signature';

@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private prisma: PrismaService) {}

  // Backward-compatible browser return for sessions created while the Didit
  // callback was accidentally configured to this POST-only webhook endpoint.
  @Public()
  @Get('didit')
  @Redirect('https://infotier-dashboard.onrender.com/?verification=complete', 302)
  diditReturn(@Query('status') status?: string) {
    const dashboard = (process.env.DASHBOARD_ORIGIN || 'https://infotier-dashboard.onrender.com')
      .split(',')[0]
      .replace(/\/$/, '');
    const normalizedStatus = String(status || '').trim().toLowerCase().replace(/[^a-z_]/g, '');
    const query = new URLSearchParams({ verification: 'complete' });
    if (normalizedStatus) query.set('status', normalizedStatus);
    return { url: `${dashboard}/?${query.toString()}` };
  }

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
    let body: Record<string, any>;
    try {
      body = verifyDiditWebhook(request.rawBody, { signatureV2, signatureRaw, signatureSimple, timestamp }, secret);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid webhook');
    }
    if (!body.event_id || !body.webhook_type) throw new BadRequestException('Missing event identity');
    try {
      return await this.prisma.$transaction(async prisma => {
        // The unique eventId constraint makes claiming an event atomic. Two
        // concurrent deliveries cannot both apply the verification update.
        await prisma.webhookEvent.create({
          data: { eventId: body.event_id, webhookType: body.webhook_type, sessionId: body.session_id || body.business_session_id, status: body.status },
        });
        if (!['status.updated', 'data.updated'].includes(body.webhook_type) || !body.session_id) {
          return { received: true, stored: true };
        }
        const status = String(body.status || '').trim().toLowerCase().replace(/\s+/g, '_');
        const verification = await prisma.verification.findUnique({ where: { providerSessionId: body.session_id } });
        if (!verification) return { received: true, stored: true };
        const scores = [...(body.decision?.liveness_checks || []), ...(body.decision?.face_matches || [])]
          .map((value: any) => Number(value.score)).filter(Number.isFinite);
        const score = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length / 100 : undefined;
        await prisma.verification.update({
          where: { id: verification.id },
          data: { status, score, completedAt: ['approved', 'declined'].includes(status) ? new Date() : null, decisionReason: `didit:${body.webhook_type}` },
        });
        await prisma.auditLog.create({
          data: { verificationId: verification.id, action: status, actor: 'didit', meta: { eventId: body.event_id, providerSessionId: body.session_id } },
        });
        return { received: true };
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return { received: true, duplicate: true };
      }
      throw error;
    }
  }
}
