import {
  Body,
  Controller,
  Post,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AwsCognitoService } from './aws-cognito.service';
import { RegisterUserDto } from './dtos/register-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';
import { Public } from 'src/commons/decorators/public-route.decorator';
import { ChangePasswordUserDto } from './dtos/change-password-user.dto';
import { ForgotPasswordUserDto } from './dtos/forgot-password-user.dto';
import { ConfirmPasswordUserDto } from './dtos/confirm-password-user.dto';
import { RefreshTokenUserDto } from './dtos/refresh-token-user.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private awsCognitoService: AwsCognitoService) {}

  @Post('/register')
  async register(@Body() authRegisterUserDto: RegisterUserDto) {
    return this.awsCognitoService.registerUser(authRegisterUserDto);
  }

  @Post('/login')
  async login(@Body() authLoginUserDto: LoginUserDto) {
    const authResult = await this.awsCognitoService.authenticateUser(authLoginUserDto);
    return authResult;
  }

  @Post('/change-password')
  async changePassword(@Body() authChangePasswordUserDto: ChangePasswordUserDto) {
    await this.awsCognitoService.changeUserPassword(authChangePasswordUserDto);
  }

  @Post('/forgot-password')
  async forgotPassword(@Body() authForgotPasswordUserDto: ForgotPasswordUserDto) {
    return await this.awsCognitoService.forgotUserPassword(authForgotPasswordUserDto);
  }

  @Post('/refresh-token')
  async refreshToken(@Body() refreshTokenUserDto: RefreshTokenUserDto) {
    try {
      return await this.awsCognitoService.refreshToken(refreshTokenUserDto);
    } catch (error) {
      // AWS Cognito errors have a 'name' property
      const errorName = error?.name || '';
      const errorMessage = error?.message || '';

      // If refresh token is expired or invalid, return 401
      if (
        errorName === 'NotAuthorizedException' ||
        errorMessage.includes('expired') ||
        errorMessage.includes('invalid')
      ) {
        throw new UnauthorizedException('Refresh token expired or invalid');
      }

      // For other errors, log and throw a generic error
      console.error('Refresh token error:', error);
      throw new HttpException('Failed to refresh token', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
