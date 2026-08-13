import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(){
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: (process.env.DASHBOARD_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean),
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
  });
  const requests = new Map<string, { count: number; reset: number }>();
  app.use((req: any, res: any, next: any) => {
    const now = Date.now();
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const login = req.path === '/v1/auth/login';
    const key = login ? `${ip}:login` : `${ip}:api`;
    const limit = login ? 10 : 120;
    const state = requests.get(key);
    if (!state || state.reset <= now) requests.set(key, { count: 1, reset: now + 60_000 });
    else if (++state.count > limit) return res.status(429).json({ message: 'Too many requests' });
    next();
  });
  await app.listen(process.env.PORT || 3000);
  console.log('Infotier API listening');
}
bootstrap();
