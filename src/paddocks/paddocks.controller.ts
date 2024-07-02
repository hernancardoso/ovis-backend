import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PaddocksService } from './paddocks.service';
import { CreatePaddockDto } from './dto/create-paddock.dto';
import { UpdatePaddockDto } from './dto/update-paddock.dto';
import { UserEstablishmentId } from 'src/commons/decorators/user-establishment-id.decorator';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';

@Controller('paddocks')
export class PaddocksController {
  constructor(private readonly paddocksService: PaddocksService) {}

  @Post()
  create(@UserEstablishmentId() establishmentId: EstablishmentEntity['id'], @Body() createPaddockDto: CreatePaddockDto) {
    return this.paddocksService.create(establishmentId, createPaddockDto);
  }

  @Get()
  findAll() {
    return this.paddocksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paddocksService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaddockDto: UpdatePaddockDto) {
    return this.paddocksService.update(+id, updatePaddockDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paddocksService.remove(+id);
  }
}
