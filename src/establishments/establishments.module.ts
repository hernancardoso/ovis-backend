import { Module } from '@nestjs/common';
import { EstablishmentsService } from './establishments.service';
import { EstablishmentsController } from './establishments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstablishmentEntity } from './entities/establishment.entity';
import { CollarsModule } from 'src/collars/collars.module';
import { CollarEntity } from 'src/collars/entities/collar.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EstablishmentEntity, CollarEntity])],
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService],
})
export class EstablishmentsModule {}
