import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import {
  IConfigService,
  ITypeOrmConfig,
} from 'src/config/interfaces/config.interface';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(
    private readonly configService: ConfigService<IConfigService, true>
  ) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const typeOrmConfig = this.configService.get<ITypeOrmConfig>('typeorm');

    return {
      type: typeOrmConfig.engine,
      host: typeOrmConfig.host,
      port: typeOrmConfig.port,
      username: typeOrmConfig.username,
      password: typeOrmConfig.password,
      database: typeOrmConfig.name,
      synchronize: typeOrmConfig.synchronize,
      entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
      autoLoadEntities: true,
    };
  }
}
