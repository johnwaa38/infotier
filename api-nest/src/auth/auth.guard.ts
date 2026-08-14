import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ApiKeysService } from './api-keys.service';
import { ADMIN_ONLY_KEY } from './admin-only.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private auth: AuthService, private apiKeys: ApiKeysService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      request.user = this.auth.verify(header.slice(7));
      const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [context.getHandler(), context.getClass()]);
      if (adminOnly && request.user.role !== 'admin') throw new UnauthorizedException('Administrator authentication required');
      return true;
    }
    const apiKey = request.headers['x-api-key'];
    if (typeof apiKey === 'string') {
      const principal = await this.apiKeys.authenticate(apiKey);
      if (principal) {
        const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [context.getHandler(), context.getClass()]);
        if (adminOnly) throw new UnauthorizedException('Administrator authentication required');
        request.user = principal; return true;
      }
    }
    throw new UnauthorizedException('Authentication required');
  }
}
