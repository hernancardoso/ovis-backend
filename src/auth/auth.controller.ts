import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { AwsCognitoService } from './aws-cognito.service';
import { RegisterUserDto } from './dtos/register-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';
import { Public } from 'src/commons/decorators/public-route.decorator';
import { ChangePasswordUserDto } from './dtos/change-password-user.dto';
import { ForgotPasswordUserDto } from './dtos/forgot-password-user.dto';
import { ConfirmPasswordUserDto } from './dtos/confirm-password-user.dto';

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
    return this.awsCognitoService.authenticateUser(authLoginUserDto);
  }

  @Post('/change-password')
  async changePassword(@Body() authChangePasswordUserDto: ChangePasswordUserDto) {
    await this.awsCognitoService.changeUserPassword(authChangePasswordUserDto);
  }

  @Post('/forgot-password')
  async forgotPassword(@Body() authForgotPasswordUserDto: ForgotPasswordUserDto) {
    return await this.awsCognitoService.forgotUserPassword(authForgotPasswordUserDto);
  }

  @Post('/confirm-password')
  async confirmPassword(@Body() authConfirmPasswordUserDto: ConfirmPasswordUserDto) {
    return await this.awsCognitoService.confirmUserPassword(authConfirmPasswordUserDto);
  }
}
