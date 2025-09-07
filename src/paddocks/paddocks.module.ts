import { forwardRef, Module } from '@nestjs/common';
import { PaddocksService } from './paddocks.service';
import { PaddocksController } from './paddocks.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaddockEntity } from './entities/paddock.entity';
import { SheepModule } from 'src/sheep/sheep.module';

@Module({
  imports: [TypeOrmModule.forFeature([PaddockEntity]), forwardRef(() => SheepModule)],
  controllers: [PaddocksController],
  providers: [PaddocksService],
  exports: [PaddocksService],
})
export class PaddocksModule {}
