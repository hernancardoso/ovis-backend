import { Module } from '@nestjs/common';
import { PaddocksService } from './paddocks.service';
import { PaddocksController } from './paddocks.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaddockEntity } from './entities/paddock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaddockEntity])],
  controllers: [PaddocksController],
  providers: [PaddocksService],
  exports: [PaddocksService],
})
export class PaddocksModule {}
