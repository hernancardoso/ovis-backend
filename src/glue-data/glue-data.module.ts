import { Module } from '@nestjs/common';
import { GlueDataService } from './glue-data.service';
import { GlueDataController } from './glue-data.controller';

@Module({
  controllers: [GlueDataController],
  providers: [GlueDataService],
  exports: [GlueDataService],
})
export class GlueDataModule {}

