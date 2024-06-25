import { z } from 'zod';
import { collarSchema } from '../schema/collar.schema';

export type CollarDto = z.infer<typeof collarSchema>;
