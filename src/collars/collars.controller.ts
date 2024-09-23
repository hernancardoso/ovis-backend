import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';
import { z } from 'zod';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { User } from 'src/commons/decorators/user.decorator';
import { CollarFilterDto } from './dto/collar-filter.dto';

@Controller('collars')
export class CollarsController {
  constructor(private readonly collarsService: CollarsService) {}

  @Post()
  create(@User('establishmentId') establishmentId: EstablishmentEntity['id'], @Body() createCollarDto: CreateCollarDto) {
    return this.collarsService.create(establishmentId, createCollarDto);
  }

  @Get()
  findAll(@User('establishmentId') establishmentId: EstablishmentEntity['id'], @Query() filter?: CollarFilterDto) {
    return this.collarsService.findAll(establishmentId, filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.collarsService.findOne(id);
  }

  @Patch(':id')
  update(
    @User('establishmentId') establishmentId: EstablishmentEntity['id'],
    @Param('id') id: string,
    @Body() updateCollarDto: UpdateCollarDto
  ) {
    return this.collarsService.update(establishmentId, id, updateCollarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.collarsService.remove(+id);
  }
}
