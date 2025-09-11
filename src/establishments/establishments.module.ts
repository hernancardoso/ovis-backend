import { Module, forwardRef } from '@nestjs/common';
import { EstablishmentsService } from './establishments.service';
import { EstablishmentsController } from './establishments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstablishmentEntity } from './entities/establishment.entity';
import { CollarsModule } from 'src/collars/collars.module';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { BreedsModule } from 'src/breeds/breeds.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EstablishmentEntity]),
    forwardRef(() => CollarsModule),
    BreedsModule,
  ],
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService],
  exports: [EstablishmentsService],
})
export class EstablishmentsModule {}
