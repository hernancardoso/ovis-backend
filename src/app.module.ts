/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { CollarsModule } from './collars/collars.module';
import { AppService } from './app.service';
import { EstablishmentsModule } from './establishments/establishments.module';
import { TypeOrmModule } from './datasource/typeorm.module';
import { SheepModule } from './sheep/sheep.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    CollarsModule,
    TypeOrmModule,
    EstablishmentsModule,
    SheepModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
