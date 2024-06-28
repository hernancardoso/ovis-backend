import { Module } from '@nestjs/common';
import { SheepService } from './sheep.service';
import { SheepController } from './sheep.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SheepEntity } from './entities/sheep.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SheepEntity])],
  controllers: [SheepController],
  providers: [SheepService],
})
export class SheepModule {}
