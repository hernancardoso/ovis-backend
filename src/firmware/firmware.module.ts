import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirmwareController } from './firmware.controller';
import { FirmwareService } from './firmware.service';
import { FirmwareArtifactEntity } from './entities/firmware-artifact.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FirmwareArtifactEntity])],
  controllers: [FirmwareController],
  providers: [FirmwareService],
  exports: [FirmwareService],
})
export class FirmwareModule {}

