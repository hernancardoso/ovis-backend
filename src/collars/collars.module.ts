import { Module } from '@nestjs/common';
import { CollarsService } from './collars.service';
import { CollarsController } from './collars.controller';

@Module({
  controllers: [CollarsController],
  providers: [CollarsService],
})
export class CollarsModule {}
