import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SheepService } from './sheep.service';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';
import { User } from 'src/commons/decorators/user.decorator';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';

@Controller('sheep')
export class SheepController {
  constructor(private readonly sheepService: SheepService) {}

  @Post()
  create(@User('establishmentId') establishmentId: EstablishmentEntity['id'], @Body() createSheepDto: CreateSheepDto) {
    return this.sheepService.create(establishmentId, createSheepDto);
  }

  @Get()
  findAll() {
    return this.sheepService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sheepService.findOne(id);
  }

  @Patch(':id')
  update(
    @User('establishmentId') establishmentId: EstablishmentEntity['id'],
    @Param('id') id: string,
    @Body() updateSheepDto: UpdateSheepDto
  ) {
    return this.sheepService.update(establishmentId, id, updateSheepDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sheepService.remove(+id);
  }
}
