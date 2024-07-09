import { z } from 'zod';
import { cognitoConfigSchema, configServiceSchema, typeOrmConfigSchema } from '../schemas/config.schema';

export type IConfigService = z.infer<typeof configServiceSchema>;

export type ITypeOrmConfig = z.infer<typeof typeOrmConfigSchema>;

export type CognitoConfig = z.infer<typeof cognitoConfigSchema>;
