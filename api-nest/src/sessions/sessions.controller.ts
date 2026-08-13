import { Body, Controller, Get, Post, Req, ForbiddenException } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { Public } from '../auth/public.decorator';

@Controller('v1/sessions')
export class SessionsController {
  constructor(private svc: SessionsService) {}
  @Public()
  @Post('public')
  createPublic(@Body() body: { userReference?: string; returnUrl?: string }) {
    return this.svc.createSession({ ...body, customerId: 'infotier-public' });
  }
  @Post()
  create(@Req() req: any, @Body() body: { customerId?: string; userReference?: string; returnUrl?: string }) {
    const customerId = req.user?.role === 'customer' ? req.user.customerId : body?.customerId;
    if (req.user?.role === 'customer' && body?.customerId && body.customerId !== customerId) throw new ForbiddenException('API key cannot act for another customer');
    return this.svc.createSession({ ...(body || {}), customerId });
  }
  @Public()
  @Get('provider-status')
  providerStatus() { return this.svc.providerStatus(); }
}
