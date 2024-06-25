import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CreateCollarDto } from './dto/create-collar.dto';
import { UpdateCollarDto } from './dto/update-collar.dto';

@Controller('collars')
export class CollarsController {
  constructor(private readonly collarsService: CollarsService) {}

  @Post()
  create(@Body() createCollarDto: CreateCollarDto) {
    return this.collarsService.create(createCollarDto);
  }

  @Get()
  findAll() {
    return this.collarsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.collarsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCollarDto: UpdateCollarDto) {
    return this.collarsService.update(id, updateCollarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.collarsService.remove(+id);
  }
}
