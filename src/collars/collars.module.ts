import { Module } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CollarsController } from './collars.controller';
import { CollarEntity } from './entities/collar.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([CollarEntity])],
  controllers: [CollarsController],
  providers: [CollarsService],

})
export class CollarsModule {}
