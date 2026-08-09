import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { DecisionService } from './decision.service';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';

@Module({
  controllers: [VerificationsController],
  providers: [PrismaService, DecisionService, VerificationsService],
})
export class VerificationsModule {}
