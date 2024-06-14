import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SheepService } from './sheep.service';
import { CreateSheepDto } from './dto/create-sheep.dto';
import { UpdateSheepDto } from './dto/update-sheep.dto';

@Controller('sheep')
export class SheepController {
  constructor(private readonly sheepService: SheepService) {}

  @Post()
  create(@Body() createSheepDto: CreateSheepDto) {
    return this.sheepService.create(createSheepDto);
  }

  @Get()
  findAll() {
    return this.sheepService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sheepService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSheepDto: UpdateSheepDto) {
    return this.sheepService.update(+id, updateSheepDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sheepService.remove(+id);
  }
}
