import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportsService } from './exports.service';
import { ExportsController } from './exports.controller';
import { CollarEntity } from 'src/collars/entities/collar.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CollarEntity])],
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
