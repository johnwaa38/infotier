import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApiKeysService } from './api-keys.service';
import { CustomersController, CustomerPortalController } from './customers.controller';
import { PrismaService } from '../common/prisma.service';

@Module({ controllers: [AuthController, CustomersController, CustomerPortalController], providers: [AuthService, ApiKeysService, PrismaService], exports: [AuthService, ApiKeysService] })
export class AuthModule {}
