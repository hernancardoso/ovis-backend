/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CollarsModule } from './collars/collars.module';
import { AppService } from './app.service';
import { EstablishmentsModule } from './establishments/establishments.module';
import { TypeOrmModule } from './datasource/typeorm.module';
import { SheepModule } from './sheep/sheep.module';

@Module({
  imports: [CollarsModule, TypeOrmModule, EstablishmentsModule, SheepModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }