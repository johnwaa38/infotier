import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

type TokenPayload = { sub: string; role: 'admin' | 'customer'; customerId?: string; customerRole?: string; exp: number };

@Injectable()
export class AuthService {
  private secret(): string {
    const value = process.env.JWT_SECRET;
    if (!value || value.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
    return value;
  }

  login(password: unknown) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || typeof password !== 'string' || !this.safeEqual(password, expected)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload: TokenPayload = { sub: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) + 28800 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return { accessToken: `${encoded}.${this.sign(encoded)}`, expiresIn: 28800 };
  }

  customerSession(customerId: string, customerRole = 'customer') {
    const payload: TokenPayload = { sub: customerId, role: 'customer', customerId, customerRole, exp: Math.floor(Date.now() / 1000) + 28800 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return { accessToken: `${encoded}.${this.sign(encoded)}`, expiresIn: 28800 };
  }

  verify(token: string): TokenPayload {
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra || !this.safeEqual(signature, this.sign(encoded))) {
      throw new UnauthorizedException('Invalid token');
    }
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
      if (!['admin', 'customer'].includes(payload.role) || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('expired');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private sign(value: string) { return createHmac('sha256', this.secret()).update(value).digest('base64url'); }
  private safeEqual(a: string, b: string) {
    const left = Buffer.from(a); const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
