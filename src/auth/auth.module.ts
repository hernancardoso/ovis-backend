import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';

import { AuthController } from './auth.controller';
import { AwsCognitoService } from './aws-cognito.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from 'src/commons/guards/auth.guard';
import { UserManagementService } from './user-management.service';
import { UserManagementController } from './user-management.controller';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [AuthService, AwsCognitoService, JwtStrategy, UserManagementService],
  controllers: [AuthController, UserManagementController],
})
export class AuthModule {}
