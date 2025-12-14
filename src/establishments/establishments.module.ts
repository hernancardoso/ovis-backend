import { Module, forwardRef } from '@nestjs/common';
import { EstablishmentsService } from './establishments.service';
import { EstablishmentsController } from './establishments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstablishmentEntity } from './entities/establishment.entity';
import { CollarsModule } from 'src/collars/collars.module';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { BreedsModule } from 'src/breeds/breeds.module';
import { PaddocksModule } from 'src/paddocks/paddocks.module';
import { SheepModule } from 'src/sheep/sheep.module';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EstablishmentEntity, PaddockEntity]),
    forwardRef(() => CollarsModule),
    forwardRef(() => PaddocksModule),
    forwardRef(() => SheepModule),
    BreedsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService],
  exports: [EstablishmentsService],
})
export class EstablishmentsModule {}
