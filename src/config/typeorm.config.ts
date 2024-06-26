import { Logger } from '@nestjs/common';
import { ITypeOrmConfig } from './interfaces/config.interface';
import { typeOrmConfigSchema } from './schemas/config.schema';
import { exit } from 'process';

export default (): { typeorm: ITypeOrmConfig } => {
  try {
    return {
      typeorm: typeOrmConfigSchema.parse({
        engine: process.env.DATABASE_ENGINE,
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT || '', 10),
        username: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD || '',
        name: process.env.DATABASE_NAME,
        synchronize: Boolean(process.env.DATABASE_SYNCHRONIZE) || false,
      }),
    };
  } catch (error) {
    Logger.error('Error loading typeorm config', error, 'AuthConfig');
    exit(1);
  }
};
