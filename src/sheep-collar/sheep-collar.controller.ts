import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SheepCollarService } from './sheep-collar.service';
import { DeleteSheepCollarDto } from './dto/delete-sheep-collar.dto';

@Controller('sheep-collar')
export class SheepCollarController {
  constructor(private readonly sheepCollarService: SheepCollarService) {}

  @Get(':id') // Get history of all associations for a collar
  findOne(@Param('id') collarId: string) {
    return this.sheepCollarService.findAll(collarId);
  }

  @Delete()
  async delete(@Body() deleteDto: DeleteSheepCollarDto) {
    // Convert date strings to Date objects
    const assignedFrom = new Date(deleteDto.assignedFrom);
    // assignedUntil is optional - if not provided, pass undefined (not null)
    // If provided as empty string or null, treat it as explicit null
    const assignedUntil = deleteDto.assignedUntil !== undefined
      ? (deleteDto.assignedUntil ? new Date(deleteDto.assignedUntil) : null)
      : undefined;

    return this.sheepCollarService.delete({
      collarId: deleteDto.collarId,
      sheepId: deleteDto.sheepId,
      assignedFrom,
      assignedUntil,
    });
  }

}
