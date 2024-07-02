import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SheepCollarService } from './sheep-collar.service';
import { CreateSheepCollarDto } from './dto/create-sheep-collar.dto';
import { UpdateSheepCollarDto } from './dto/update-sheep-collar.dto';
import { AssignCollarToSheepDto } from './dto/assign-collar-to-sheep.dto';
import { UnassignCollarToSheepDto } from './dto/unassign-collar-to-sheep.dto copy';

@Controller('sheep-collar')
export class SheepCollarController {
  constructor(private readonly sheepCollarService: SheepCollarService) {}

  @Post('/assign')
  assign(@Body() assignCollarToSheepDto: AssignCollarToSheepDto) {
    return this.sheepCollarService.assign(assignCollarToSheepDto);
  }

  @Post('/unassign')
  unassign(@Body() unassignCollarToSheepDto: UnassignCollarToSheepDto) {
    return this.sheepCollarService.unassign(unassignCollarToSheepDto);
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
