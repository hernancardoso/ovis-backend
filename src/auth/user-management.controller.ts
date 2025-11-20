import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from 'src/commons/guards/admin.guard';
import { AdminRoute } from 'src/commons/decorators/admin-route.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Post()
  @AdminRoute()
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userManagementService.createUser(createUserDto);
  }

  @Get()
  @AdminRoute()
  async listUsers() {
    return this.userManagementService.listUsers();
  }

  @Get(':email')
  @AdminRoute()
  async getUser(@Param('email') email: string) {
    return this.userManagementService.getUser(email);
  }

  @Put(':email')
  @AdminRoute()
  async updateUser(@Param('email') email: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userManagementService.updateUser(email, updateUserDto);
  }

  @Delete(':email')
  @AdminRoute()
  async deleteUser(@Param('email') email: string) {
    return this.userManagementService.deleteUser(email);
  }
}

