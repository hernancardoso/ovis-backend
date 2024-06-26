import { z } from 'zod';
import {
  authConfigSchema,
  configServiceSchema,
  typeOrmConfigSchema,
} from '../schemas/config.schema';

export type IConfigService = z.infer<typeof configServiceSchema>;

export type ITypeOrmConfig = z.infer<typeof typeOrmConfigSchema>;

export type IAuthConfig = z.infer<typeof authConfigSchema>;
