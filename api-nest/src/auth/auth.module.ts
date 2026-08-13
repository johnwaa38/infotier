import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApiKeysService } from './api-keys.service';
import { CustomersController } from './customers.controller';

@Module({ controllers: [AuthController, CustomersController], providers: [AuthService, ApiKeysService], exports: [AuthService, ApiKeysService] })
export class AuthModule {}
