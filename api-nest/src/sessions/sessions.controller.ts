import { Body, Controller, Get, Post } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { Public } from '../auth/public.decorator';

@Controller('v1/sessions')
export class SessionsController {
  constructor(private svc: SessionsService) {}
  @Public()
  @Post()
  create(@Body() body: { customerId?: string; userReference?: string; returnUrl?: string }) { return this.svc.createSession(body || {}); }
  @Public()
  @Get('provider-status')
  providerStatus() { return this.svc.providerStatus(); }
}
