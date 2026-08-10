import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  @Get('health')
  @Public()
  health() {
    return { ok: true, service: 'infotier-api' };
  }
}
