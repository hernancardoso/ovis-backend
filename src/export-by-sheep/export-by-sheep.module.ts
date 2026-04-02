import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';
import { SheepCollarModule } from 'src/sheep-collar/sheep-collar.module';
import { ExportBySheepController } from './export-by-sheep.controller';
import { ExportBySheepService } from './export-by-sheep.service';

@Module({
  imports: [TypeOrmModule.forFeature([SheepEntity, CollarEntity]), SheepCollarModule],
  controllers: [ExportBySheepController],
  providers: [ExportBySheepService],
  exports: [ExportBySheepService],
})
export class ExportBySheepModule {}
