import { Module } from '@nestjs/common';
import { SheepCollarService } from './sheep-collar.service';
import { SheepCollarController } from './sheep-collar.controller';
import { SheepCollarEntity } from './entities/sheep-collar.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollarsModule } from 'src/collars/collars.module';
import { SheepModule } from 'src/sheep/sheep.module';

@Module({
  imports: [TypeOrmModule.forFeature([SheepCollarEntity]), CollarsModule, SheepModule],
  controllers: [SheepCollarController],
  providers: [SheepCollarService],
})
export class SheepCollarModule {}
