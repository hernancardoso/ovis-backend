import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  ForbiddenException,
  Patch,
} from '@nestjs/common';
import { GlueDataService } from './glue-data.service';
import { AddColumnDto } from './dto/add-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { User } from 'src/commons/decorators/user.decorator';
import { User as IUser } from 'src/commons/interfaces/user.interface';

@Controller('glue-data')
export class GlueDataController {
  constructor(private readonly glueDataService: GlueDataService) {}

  @Get('schema')
  async getSchema(@User() user: IUser) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.glueDataService.getTableSchema();
  }

  @Post('columns')
  async addColumn(@User() user: IUser, @Body() addColumnDto: AddColumnDto) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.glueDataService.addColumn(
      addColumnDto.name,
      addColumnDto.type,
      addColumnDto.comment,
      addColumnDto.category
    );
  }

  @Delete('columns/:columnName')
  async deleteColumn(@User() user: IUser, @Param('columnName') columnName: string) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.glueDataService.deleteColumn(columnName);
  }

  @Patch('columns/:columnName')
  async updateColumn(
    @User() user: IUser,
    @Param('columnName') columnName: string,
    @Body() updateColumnDto: UpdateColumnDto
  ) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.glueDataService.updateColumn(
      columnName,
      updateColumnDto.type,
      updateColumnDto.comment,
      updateColumnDto.category
    );
  }
}
