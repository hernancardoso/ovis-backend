import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserManagementService } from '../auth/user-management.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from 'src/commons/decorators/user.decorator';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get('profile')
  async getProfile(@User('email') email: string) {
    // User can only get their own profile
    return this.userManagementService.getUser(email);
  }

  @Put('profile')
  async updateProfile(@User('email') email: string, @Body() updateProfileDto: UpdateProfileDto) {
    // Users can only update their own profile (name and language)
    return this.userManagementService.updateUser(email, updateProfileDto);
  }
}

