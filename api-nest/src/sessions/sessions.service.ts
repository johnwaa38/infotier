import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

type CreateSessionInput = { customerId?: string; userReference?: string; returnUrl?: string };

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async createSession(input: CreateSessionInput) {
    const apiKey = process.env.DIDIT_API_KEY;
    const workflowId = process.env.DIDIT_WORKFLOW_ID;
    if (!apiKey || !workflowId) throw new ServiceUnavailableException('No customer verification provider is connected');
    const customerId = this.clean(input.customerId, 'customerId');
    const userReference = this.clean(input.userReference, 'userReference');
    const verification = await this.prisma.verification.create({
      data: { customerId, userReference, idType: 'document', status: 'provider_session_pending' },
    });
    try {
      const response = await fetch('https://verification.didit.me/v3/session/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({
          workflow_id: workflowId,
          vendor_data: verification.id,
          callback: process.env.DIDIT_CALLBACK_URL || input.returnUrl,
          callback_method: 'both',
          metadata: { customerId, userReference },
          language: 'en',
        }),
      });
      if (!response.ok) throw new Error(`Didit returned ${response.status}`);
      const session = await response.json() as { session_id: string; status: string; url: string };
      await this.prisma.$transaction([
        this.prisma.verification.update({
          where: { id: verification.id },
          data: { status: this.normalizeStatus(session.status), provider: 'didit', providerSessionId: session.session_id },
        }),
        this.prisma.auditLog.create({
          data: { verificationId: verification.id, action: 'provider_session_created', actor: 'infotier', meta: { provider: 'didit' } },
        }),
      ]);
      return { verificationId: verification.id, provider: 'didit', url: session.url };
    } catch (error) {
      await this.prisma.verification.update({ where: { id: verification.id }, data: { status: 'provider_error' } });
      throw new ServiceUnavailableException('The customer verification provider could not create a session');
    }
  }

  providerStatus() {
    return { provider: 'didit', connected: Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID), mode: process.env.DIDIT_MODE || 'live', freeMonthlyLimit: 500 };
  }

  private normalizeStatus(status: string) {
    return status.trim().toLowerCase().replace(/\s+/g, '_');
  }

  private clean(value: unknown, field: string) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(value)) throw new BadRequestException(`${field} is invalid`);
    return value;
  }
}
