import { Module } from '@nestjs/common';
import { SheepService } from './sheep.service';
import { SheepController } from './sheep.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SheepEntity } from './entities/sheep.entity';
import { EstablishmentsService } from 'src/establishments/establishments.service';
import { EstablishmentsModule } from 'src/establishments/establishments.module';
import { PaddocksModule } from 'src/paddocks/paddocks.module';

@Module({
  imports: [TypeOrmModule.forFeature([SheepEntity]), PaddocksModule],
  controllers: [SheepController],
  providers: [SheepService],
  exports: [SheepService],
})
export class SheepModule {}
