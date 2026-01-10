import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto/create-export.dto';
import { User } from 'src/commons/decorators/user.decorator';
import { User as IUser } from 'src/commons/interfaces/user.interface';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  async createExport(
    @User() user: IUser,
    @Body() createExportDto: CreateExportDto
  ) {
    return this.exportsService.createExport(createExportDto);
  }

  @Get(':jobId/status')
  async getExportStatus(
    @User() user: IUser,
    @Param('jobId') jobId: string
  ) {
    return this.exportsService.getExportStatus(jobId);
  }

  @Get(':jobId/files')
  async getExportFiles(
    @User() user: IUser,
    @Param('jobId') jobId: string
  ) { 
    return this.exportsService.getExportFiles(jobId);
  }

  @Get(':jobId/files/refresh')
  async refreshDownloadUrls(
    @User() user: IUser,
    @Param('jobId') jobId: string
  ) {
    return this.exportsService.refreshDownloadUrls(jobId);
  }
}

