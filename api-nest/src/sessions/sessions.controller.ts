import { Body, Controller, Get, Post } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('v1/sessions')
export class SessionsController {
  constructor(private svc: SessionsService) {}
  @Post()
  create(@Body() body: { customerId?: string; userReference?: string; returnUrl?: string }) { return this.svc.createSession(body || {}); }
  @Get('provider-status')
  providerStatus() { return this.svc.providerStatus(); }
}
