import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SheepCollarService } from './sheep-collar.service';
import { CreateSheepCollarDto } from './dto/create-sheep-collar.dto';
import { UpdateSheepCollarDto } from './dto/update-sheep-collar.dto';
import { AssignCollarToSheepDto } from './dto/assign-collar-to-sheep.dto';
import { UnassignCollarToSheepDto } from './dto/unassign-collar-to-sheep.dto copy';

@Controller('sheep-collar')
export class SheepCollarController {
  constructor(private readonly sheepCollarService: SheepCollarService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sheepCollarService.findAll(id);
  }
}
