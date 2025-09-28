import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './common/prisma.service';
import { SessionsModule } from './sessions/sessions.module';
import { VerificationsModule } from './verifications/verifications.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SessionsModule, VerificationsModule, WebhooksModule],
  providers: [PrismaService],
})
export class AppModule {}
