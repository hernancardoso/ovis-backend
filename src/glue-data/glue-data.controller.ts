import { Controller, Get, Post, Body, Delete, Param, ForbiddenException } from '@nestjs/common';
import { GlueDataService } from './glue-data.service';
import { AddColumnDto } from './dto/add-column.dto';
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
  async addColumn(
    @User() user: IUser,
    @Body() addColumnDto: AddColumnDto
  ) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.glueDataService.addColumn(addColumnDto.name, addColumnDto.type, addColumnDto.comment);
  }

  @Delete('columns/:columnName')
  async deleteColumn(
    @User() user: IUser,
    @Param('columnName') columnName: string
  ) {
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.glueDataService.deleteColumn(columnName);
  }
}

