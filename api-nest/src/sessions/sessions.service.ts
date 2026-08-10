import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../common/prisma.service';

type CreateSessionInput = { customerId?: string; userReference?: string; returnUrl?: string };

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async createSession(input: CreateSessionInput) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new ServiceUnavailableException('No customer verification provider is connected');
    const customerId = this.clean(input.customerId, 'customerId');
    const userReference = this.clean(input.userReference, 'userReference');
    const verification = await this.prisma.verification.create({
      data: { customerId, userReference, idType: 'document', status: 'provider_session_pending' },
    });
    try {
      const stripe = new Stripe(secret);
      const session = await stripe.identity.verificationSessions.create({
        type: 'document',
        metadata: { infotierVerificationId: verification.id, customerId, userReference },
        options: { document: { require_matching_selfie: true } },
        ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
      });
      await this.prisma.$transaction([
        this.prisma.verification.update({
          where: { id: verification.id },
          data: { status: session.status, provider: 'stripe', providerSessionId: session.id },
        }),
        this.prisma.auditLog.create({
          data: { verificationId: verification.id, action: 'provider_session_created', actor: 'infotier', meta: { provider: 'stripe' } },
        }),
      ]);
      return { verificationId: verification.id, provider: 'stripe', url: session.url };
    } catch (error) {
      await this.prisma.verification.update({ where: { id: verification.id }, data: { status: 'provider_error' } });
      throw new ServiceUnavailableException('The customer verification provider could not create a session');
    }
  }

  providerStatus() {
    return { provider: 'stripe', connected: Boolean(process.env.STRIPE_SECRET_KEY), mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test' };
  }

  private clean(value: unknown, field: string) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(value)) throw new BadRequestException(`${field} is invalid`);
    return value;
  }
}
