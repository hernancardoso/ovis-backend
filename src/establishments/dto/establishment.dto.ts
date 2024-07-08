import { z } from 'zod';
import { establishmentSchema, establishmentWithCollarsSchema } from '../schemas/establishment.schema';

export type EstablishmentDto = z.infer<typeof establishmentSchema>;

export type EstablishmentWithCollarsDto = z.infer<typeof establishmentWithCollarsSchema>;
