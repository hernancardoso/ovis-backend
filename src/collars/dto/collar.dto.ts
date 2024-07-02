import { z } from 'zod';
import { collarSchema } from '../schemas/collar.schema';

export type CollarDto = z.infer<typeof collarSchema>;
