import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShadowParamEntity } from './entities/shadow-param.entity';
import { ShadowParamsService } from './shadow-params.service';
import { ShadowParamsController } from './shadow-params.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShadowParamEntity])],
  controllers: [ShadowParamsController],
  providers: [ShadowParamsService],
  exports: [ShadowParamsService],
})
export class ShadowParamsModule {}
