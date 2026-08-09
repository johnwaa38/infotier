import { Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service';
import { SessionsModule } from './sessions/sessions.module';
import { VerificationsModule } from './verifications/verifications.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AppController } from './app.controller';

@Module({
  imports: [SessionsModule, VerificationsModule, WebhooksModule],
  providers: [PrismaService],
  controllers: [AppController],
})
export class AppModule {}
