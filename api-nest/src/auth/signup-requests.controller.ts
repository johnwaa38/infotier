import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { Public } from './public.decorator';
import { AdminOnly } from './admin-only.decorator';
import { OwnerOnly } from './owner-only.decorator';

@Controller('v1/signup-requests')
export class SignupRequestsController {
  constructor(private keys: ApiKeysService) {}

  @Public()
  @Post()
  create(@Body() body: { businessName?: string; contactName?: string; email?: string }) {
    return this.keys.requestSignup(body || {});
  }

  @AdminOnly()
  @Get()
  list() { return this.keys.listSignupRequests(); }

  @AdminOnly()
  @Post(':id/approve')
  approve(@Param('id') id: string) { return this.keys.approveSignup(id); }

  @AdminOnly()
  @Post(':id/decline')
  decline(@Param('id') id: string) { return this.keys.declineSignup(id); }
}

@OwnerOnly()
@Controller('v1/owner/signup-requests')
export class OwnerSignupRequestsController {
  constructor(private keys: ApiKeysService) {}
  @Get() list() { return this.keys.listSignupRequests(); }
  @Post(':id/approve') approve(@Param('id') id: string) { return this.keys.approveSignup(id); }
  @Post(':id/decline') decline(@Param('id') id: string) { return this.keys.declineSignup(id); }
}
