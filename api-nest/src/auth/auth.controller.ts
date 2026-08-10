import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('v1/auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Public()
  @Post('login')
  login(@Body() body: { password?: string }) { return this.auth.login(body?.password); }
}
