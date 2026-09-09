import { Controller, Get } from '@nestjs/common';
import { AdminOnly } from '../auth/admin-only.decorator';
import { OperationsService } from './operations.service';

@Controller('v1/operations')
@AdminOnly()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('status')
  status() { return this.operations.status(); }
}
