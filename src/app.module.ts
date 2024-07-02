/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { CollarsModule } from './collars/collars.module';
import { AppService } from './app.service';
import { EstablishmentsModule } from './establishments/establishments.module';
import { TypeOrmConfigModule } from './datasource/typeorm-config.module';
import { SheepModule } from './sheep/sheep.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './config/typeorm.config';
import authConfig from './config/auth.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfigService } from './datasource/typeorm-config.service';
import { SheepCollarModule } from './sheep-collar/sheep-collar.module';
import { PaddocksModule } from './paddocks/paddocks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig],
      envFilePath: ['.env.development.local'],
    }),
    TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService }),
    CollarsModule,
    EstablishmentsModule,
    SheepModule,
    AuthModule,
    SheepCollarModule,
    PaddocksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
