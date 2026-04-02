import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto/create-export.dto';
import { User } from 'src/commons/decorators/user.decorator';
import { User as IUser } from 'src/commons/interfaces/user.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AdminGuard } from 'src/commons/guards/admin.guard';
import { AdminRoute } from 'src/commons/decorators/admin-route.decorator';

@Controller('exports')
@UseGuards(JwtAuthGuard, AdminGuard)
@AdminRoute()
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  async createExport(@User() user: IUser, @Body() createExportDto: CreateExportDto) {
    return this.exportsService.createExport(createExportDto, user);
  }

  @Get('history')
  async getExportHistory(@User() user: IUser) {
    return this.exportsService.listExportHistory();
  }

  @Get(':jobId/status')
  async getExportStatus(@User() user: IUser, @Param('jobId') jobId: string) {
    return this.exportsService.getExportStatus(jobId);
  }

  @Get(':jobId/files')
  async getExportFiles(@User() user: IUser, @Param('jobId') jobId: string) {
    return this.exportsService.getExportFiles(jobId);
  }

  @Get(':jobId/files/refresh')
  async refreshDownloadUrls(@User() user: IUser, @Param('jobId') jobId: string) {
    return this.exportsService.refreshDownloadUrls(jobId);
  }
}
