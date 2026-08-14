import { Body, Controller, Get, Param, Post, Req, ForbiddenException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { AdminOnly } from './admin-only.decorator';

@AdminOnly()
@Controller('v1/customers')
export class CustomersController {
  constructor(private keys: ApiKeysService) {}
  @Get() list() { return this.keys.listCustomers(); }
  @Post() create(@Body() body: { name?: string }) { return this.keys.createCustomer(body?.name); }
  @Post(':customerId/api-keys') issue(@Param('customerId') customerId: string, @Body() body: { name?: string }) { return this.keys.issue(customerId, body?.name); }
  @Post('api-keys/:id/revoke') revoke(@Param('id') id: string) { return this.keys.revoke(id); }
}

@Controller('v1/customer')
export class CustomerPortalController {
  constructor(private keys: ApiKeysService) {}
  @Get('usage')
  usage(@Req() req: any) {
    if (req.user?.role !== 'customer') throw new ForbiddenException('Customer API key required');
    return this.keys.usage(req.user.customerId);
  }
}
