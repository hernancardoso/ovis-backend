import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { FirmwareModule } from 'src/firmware/firmware.module';
import { FotaController } from './fota.controller';
import { FotaService } from './fota.service';
import { FotaDeploymentEntity } from './entities/fota-deployment.entity';
import { FotaDeploymentTargetEntity } from './entities/fota-deployment-target.entity';
import { CollarFirmwareHistoryEntity } from './entities/collar-firmware-history.entity';

@Module({
  imports: [
    FirmwareModule,
    TypeOrmModule.forFeature([
      FotaDeploymentEntity,
      FotaDeploymentTargetEntity,
      CollarFirmwareHistoryEntity,
      CollarEntity,
    ]),
  ],
  controllers: [FotaController],
  providers: [FotaService],
  exports: [FotaService],
})
export class FotaModule {}

