import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

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

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
}
