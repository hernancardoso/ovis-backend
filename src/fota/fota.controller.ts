import { Controller, Get, Param, Post, Query, Body, UseGuards } from '@nestjs/common';
import { User } from 'src/commons/decorators/user.decorator';
import { EstablishmentEntity } from 'src/establishments/entities/establishment.entity';
import { CreateFotaDeploymentDto } from './dto/create-fota-deployment.dto';
import { FotaService } from './fota.service';
import { User as IUser } from 'src/commons/interfaces/user.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AdminGuard } from 'src/commons/guards/admin.guard';
import { AdminRoute } from 'src/commons/decorators/admin-route.decorator';

@Controller('fota')
@UseGuards(JwtAuthGuard, AdminGuard)
export class FotaController {
  constructor(private readonly fotaService: FotaService) {}

  @Post('deployments')
  @AdminRoute()
  createDeployment(
    @User() user: IUser,
    @User('establishmentId') establishmentId: EstablishmentEntity['id'],
    @Body() dto: CreateFotaDeploymentDto
  ) {
    return this.fotaService.createDeployment({
      establishmentId,
      firmwareArtifactId: dto.firmwareArtifactId,
      collarIds: dto.collarIds,
      createdByEmail: user?.email ?? null,
    });
  }

  @Get('deployments/:id/targets')
  @AdminRoute()
  getTargets(
    @User('establishmentId') establishmentId: EstablishmentEntity['id'],
    @Param('id') deploymentId: string,
    @Query('refresh') refresh?: string
  ) {
    if (refresh === 'true' || refresh === '1') {
      return this.fotaService.refreshTargets(establishmentId, deploymentId);
    }
    return this.fotaService.listTargets(establishmentId, deploymentId);
  }

  @Get('collars/:id/history')
  @AdminRoute()
  getCollarHistory(
    @Param('id') imei: string
  ) {
    return this.fotaService.getHistoryByImei(Number(imei));
  }
}

