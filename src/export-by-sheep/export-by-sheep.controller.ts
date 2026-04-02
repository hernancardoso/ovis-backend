import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User } from 'src/commons/decorators/user.decorator';
import { AdminRoute } from 'src/commons/decorators/admin-route.decorator';
import { AdminGuard } from 'src/commons/guards/admin.guard';
import { User as IUser } from 'src/commons/interfaces/user.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateExportBySheepDto } from './dto/create-export-by-sheep.dto';
import { ExportBySheepService } from './export-by-sheep.service';

@Controller('export-by-sheep')
@UseGuards(JwtAuthGuard, AdminGuard)
@AdminRoute()
export class ExportBySheepController {
  constructor(private readonly exportBySheepService: ExportBySheepService) {}

  @Post()
  async createExport(@User() user: IUser, @Body() createExportDto: CreateExportBySheepDto) {
    return this.exportBySheepService.createExport(createExportDto, user);
  }

  @Get('history')
  async getExportHistory() {
    return this.exportBySheepService.listExportHistory();
  }

  @Get(':jobId/status')
  async getExportStatus(@Param('jobId') jobId: string) {
    return this.exportBySheepService.getExportStatus(jobId);
  }

  @Get(':jobId/files')
  async getExportFiles(@Param('jobId') jobId: string) {
    return this.exportBySheepService.getExportFiles(jobId);
  }

  @Get(':jobId/files/refresh')
  async refreshDownloadUrls(@Param('jobId') jobId: string) {
    return this.exportBySheepService.refreshDownloadUrls(jobId);
  }
}
