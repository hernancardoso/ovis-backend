import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const config = this.configService.get('typeorm');

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
  }
}
