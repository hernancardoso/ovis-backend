import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CompleteFirmwareUploadDto } from './dto/complete-firmware-upload.dto';
import { CreateFirmwareUploadUrlDto } from './dto/create-firmware-upload-url.dto';
import { FirmwareService } from './firmware.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AdminGuard } from 'src/commons/guards/admin.guard';
import { AdminRoute } from 'src/commons/decorators/admin-route.decorator';

@Controller('firmwares')
@UseGuards(JwtAuthGuard, AdminGuard)
export class FirmwareController {
  constructor(private readonly firmwareService: FirmwareService) {}

  @Post('upload-url')
  @AdminRoute()
  createUploadUrl(
    @Body() dto: CreateFirmwareUploadUrlDto
  ) {
    return this.firmwareService.createUploadUrl(dto);
  }

  @Post(':id/complete')
  @AdminRoute()
  completeUpload(
    @Param('id') id: string,
    @Body() dto: CompleteFirmwareUploadDto
  ) {
    return this.firmwareService.completeUpload(id, dto.sha256);
  }

  @Get()
  @AdminRoute()
  list() {
    return this.firmwareService.list();
  }

  @Delete(':id')
  @AdminRoute()
  remove(
    @Param('id') id: string
  ) {
    return this.firmwareService.delete(id);
  }
}

