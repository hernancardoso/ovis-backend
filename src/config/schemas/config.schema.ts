import { z } from 'zod';

export const authConfigSchema = z.object({
  userPoolId: z.string(),
  clientId: z.string(),
  region: z.string(),
  authority: z.string(),
});

export const typeOrmConfigSchema = z.object({
  engine: z.enum(['mysql', 'postgres']),
  host: z.string(),
  port: z.number().int(),
  username: z.string(),
  password: z.string(),
  name: z.string(),
  synchronize: z.boolean(),
});

export const configServiceSchema = z.object({
  auth: authConfigSchema,
  typeorm: typeOrmConfigSchema,
});
