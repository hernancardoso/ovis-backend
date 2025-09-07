// src/datasource/typeorm.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import databaseConfig from '../config/typeorm.config';
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';

@Module({
  providers: [
    {
      provide: 'TYPEORM_CONFIG',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const config = configService.get('typeorm');
        return {
          type: config.engine,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          database: config.name,
          synchronize: config.synchronize,
          entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
          autoLoadEntities: true,
        };
      },
    },
  ],
  exports: ['TYPEORM_CONFIG'],
})
export class TypeOrmConfigModule {}
