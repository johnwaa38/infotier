import { BadRequestException, Controller, Headers, Post, RawBodyRequest, Req, ServiceUnavailableException } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
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
}
