import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthConfig } from './auth.config';
import { AuthController } from './auth.controller';

@Module({
  providers: [AuthConfig, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
