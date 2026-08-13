import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Controller('v1/customers')
export class CustomersController {
  constructor(private keys: ApiKeysService) {}
  @Get() list() { return this.keys.listCustomers(); }
  @Post() create(@Body() body: { name?: string }) { return this.keys.createCustomer(body?.name); }
  @Post(':customerId/api-keys') issue(@Param('customerId') customerId: string, @Body() body: { name?: string }) { return this.keys.issue(customerId, body?.name); }
  @Post('api-keys/:id/revoke') revoke(@Param('id') id: string) { return this.keys.revoke(id); }
}
