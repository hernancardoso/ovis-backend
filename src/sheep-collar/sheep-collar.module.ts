import { Module } from '@nestjs/common';
import { SheepCollarService } from './sheep-collar.service';
import { SheepCollarController } from './sheep-collar.controller';
import { SheepCollarEntity } from './entities/sheep-collar.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([SheepCollarEntity])],
  controllers: [SheepCollarController],
  providers: [SheepCollarService],
})
export class SheepCollarModule {}
