import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './common/prisma.service';
import { SessionsModule } from './sessions/sessions.module';
import { VerificationsModule } from './verifications/verifications.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AppController } from './app.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, SessionsModule, VerificationsModule, WebhooksModule],
  providers: [PrismaService, { provide: APP_GUARD, useClass: AuthGuard }],
  controllers: [AppController],
})
export class AppModule {}
