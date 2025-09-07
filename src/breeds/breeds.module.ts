import { Module } from '@nestjs/common';
import { BreedsService } from './breeds.service';
import { BreedsController } from './breeds.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BreedsEntity } from './entities/breed.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BreedsEntity])],
  controllers: [BreedsController],
  providers: [BreedsService],
  exports: [BreedsService],
})
export class BreedsModule {}
