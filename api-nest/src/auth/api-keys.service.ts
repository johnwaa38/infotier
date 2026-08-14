import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService, private auth: AuthService) {}

  async createCustomer(name: unknown) {
    if (typeof name !== 'string' || name.trim().length < 2) throw new BadRequestException('Customer name is required');
    return this.prisma.customer.create({ data: { name: name.trim() } });
  }

  listCustomers() {
    return this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' }, include: { apiKeys: { select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true } } } });
  }

  async issue(customerId: string, name: unknown) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== 'active') throw new BadRequestException('Customer is not active');
    const label = typeof name === 'string' && name.trim() ? name.trim() : 'Default';
    const secret = `it_live_${randomBytes(32).toString('base64url')}`;
    const record = await this.prisma.apiKey.create({ data: { customerId, name: label, prefix: secret.slice(0, 16), keyHash: this.hash(secret) } });
    return { id: record.id, customerId, name: record.name, prefix: record.prefix, apiKey: secret, createdAt: record.createdAt };
  }

  async revoke(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('API key not found');
    return this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() }, select: { id: true, revokedAt: true } });
  }

  async authenticate(secret: string) {
    if (!secret.startsWith('it_live_') || secret.length < 40) return null;
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: this.hash(secret) }, include: { customer: true } });
    if (!key || key.revokedAt || key.customer.status !== 'active') return null;
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return { sub: key.id, role: 'customer' as const, customerId: key.customerId };
  }

  async usage(customerId: string) {
    const [customer, total, completed, failed, recent] = await this.prisma.$transaction([
      this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, status: true, createdAt: true } }),
      this.prisma.verification.count({ where: { customerId } }),
      this.prisma.verification.count({ where: { customerId, status: { in: ['approved', 'declined', 'rejected'] } } }),
      this.prisma.verification.count({ where: { customerId, status: 'provider_error' } }),
      this.prisma.verification.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, userReference: true, status: true, score: true, provider: true, createdAt: true, completedAt: true } }),
    ]);
    if (!customer) throw new NotFoundException('Customer not found');
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const thisMonth = await this.prisma.verification.count({ where: { customerId, createdAt: { gte: monthStart } } });
    return { customer, totals: { all: total, thisMonth, completed, failed, inProgress: total - completed - failed }, recent };
  }

  async redeemPortalLogin(token: unknown) {
    if (typeof token !== 'string' || token.length < 32) throw new BadRequestException('Invalid login link');
    const tokenHash = this.hash(token);
    return this.prisma.$transaction(async prisma => {
      const record = await prisma.portalLoginToken.findUnique({ where: { tokenHash } });
      if (!record || record.usedAt || record.expiresAt <= new Date()) throw new BadRequestException('Login link is invalid or expired');
      await prisma.portalLoginToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      return this.auth.customerSession(record.customerId);
    });
  }

  async requestSignup(input: { businessName?: unknown; contactName?: unknown; email?: unknown }) {
    const businessName = this.requiredText(input?.businessName, 'Business name', 100);
    const contactName = this.requiredText(input?.contactName, 'Contact name', 100);
    if (typeof input?.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new BadRequestException('A valid email is required');
    }
    const email = input.email.trim().toLowerCase();
    await this.prisma.signupRequest.upsert({
      where: { email },
      create: { businessName, contactName, email },
      update: { businessName, contactName, status: 'pending', reviewedAt: null },
    });
    return { accepted: true };
  }

  listSignupRequests() {
    return this.prisma.signupRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async approveSignup(id: string) {
    const request = await this.prisma.signupRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Signup request not found');
    if (request.status === 'approved') throw new BadRequestException('Signup request is already approved');
    const rawToken = randomBytes(32).toString('hex');
    const result = await this.prisma.$transaction(async prisma => {
      const customer = await prisma.customer.create({ data: { name: request.businessName } });
      await prisma.portalLoginToken.create({ data: { customerId: customer.id, tokenHash: this.hash(rawToken), expiresAt: new Date(Date.now() + 7 * 86400000) } });
      await prisma.signupRequest.update({ where: { id }, data: { status: 'approved', customerId: customer.id, reviewedAt: new Date() } });
      return customer;
    });
    const dashboard = (process.env.DASHBOARD_ORIGIN || 'https://infotier-dashboard.onrender.com').replace(/\/$/, '');
    return { customer: result, portalInviteUrl: `${dashboard}/?customer=1&login=${rawToken}`, expiresInDays: 7 };
  }

  async declineSignup(id: string) {
    const request = await this.prisma.signupRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Signup request not found');
    return this.prisma.signupRequest.update({ where: { id }, data: { status: 'declined', reviewedAt: new Date() } });
  }

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private requiredText(value: unknown, label: string, max: number) {
    if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > max) throw new BadRequestException(`${label} is required`);
    return value.trim();
  }
}
