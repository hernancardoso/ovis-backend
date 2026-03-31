import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { ShadowParamsService } from './shadow-params.service';
import { CreateShadowParamDto } from './dto/create-shadow-param.dto';
import { UpdateShadowParamDto } from './dto/update-shadow-param.dto';
import { User } from 'src/commons/decorators/user.decorator';
import { User as IUser } from 'src/commons/interfaces/user.interface';

@Controller('shadow-params')
export class ShadowParamsController {
  constructor(private readonly shadowParamsService: ShadowParamsService) {}

  @Get()
  async findAll(@User() user: IUser) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.shadowParamsService.findAll();
  }

  @Post()
  async create(@User() user: IUser, @Body() dto: CreateShadowParamDto) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.shadowParamsService.create(dto);
  }

  @Patch(':id')
  async update(
    @User() user: IUser,
    @Param('id') id: string,
    @Body() dto: UpdateShadowParamDto,
  ) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.shadowParamsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@User() user: IUser, @Param('id') id: string) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.shadowParamsService.remove(id);
  }
}
