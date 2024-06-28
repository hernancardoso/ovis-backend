import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SheepCollarService } from './sheep-collar.service';
import { CreateSheepCollarDto } from './dto/create-sheep-collar.dto';
import { UpdateSheepCollarDto } from './dto/update-sheep-collar.dto';
import { AssignCollarToSheepDto } from './dto/assign-collar-to-sheep.dto';

@Controller('sheep-collar')
export class SheepCollarController {
  constructor(private readonly sheepCollarService: SheepCollarService) {}

  @Post('/assign')
  assign(@Body() assignCollarToSheepDto: AssignCollarToSheepDto) {
    return this.sheepCollarService.assign(assignCollarToSheepDto);
  }

  @Post()
  create(@Body() createSheepCollarDto: CreateSheepCollarDto) {
    return this.sheepCollarService.create(createSheepCollarDto);
  }

  @Get()
  findAll() {
    return this.sheepCollarService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sheepCollarService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSheepCollarDto: UpdateSheepCollarDto) {
    return this.sheepCollarService.update(+id, updateSheepCollarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sheepCollarService.remove(+id);
  }
}
