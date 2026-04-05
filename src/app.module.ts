/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { CollarsModule } from './collars/collars.module';
import { AppService } from './app.service';
import { EstablishmentsModule } from './establishments/establishments.module';
import { SheepModule } from './sheep/sheep.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './config/typeorm.config';
import cognitoConfig from './config/cognito.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfigService } from './datasource/typeorm-config.service';
import { SheepCollarModule } from './sheep-collar/sheep-collar.module';
import { PaddocksModule } from './paddocks/paddocks.module';
import { BreedsModule } from './breeds/breeds.module';
import { ReportsModule } from './reports/reports.module';
import { UserModule } from './user/user.module';
import { GlueDataModule } from './glue-data/glue-data.module';
import { ExportsModule } from './exports/exports.module';
import { FirmwareModule } from './firmware/firmware.module';
import { FotaModule } from './fota/fota.module';
import { ShadowParamsModule } from './shadow-params/shadow-params.module';
import { ExportBySheepModule } from './export-by-sheep/export-by-sheep.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, cognitoConfig],
      envFilePath: ['.env.development.local', '.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService }),
    CollarsModule,
    EstablishmentsModule,
    SheepModule,
    AuthModule,
    UserModule,
    SheepCollarModule,
    PaddocksModule,
    BreedsModule,
    ReportsModule,
    GlueDataModule,
    ExportsModule,
    FirmwareModule,
    FotaModule,
    ShadowParamsModule,
    ExportBySheepModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
