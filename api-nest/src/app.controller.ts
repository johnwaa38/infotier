import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { PrismaService } from './common/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @Public()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        service: 'infotier-api',
        database: 'connected',
        didit: {
          configured: Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID && process.env.DIDIT_WEBHOOK_SECRET),
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: 'infotier-api',
        database: 'unavailable',
      });
    }
  }
}
