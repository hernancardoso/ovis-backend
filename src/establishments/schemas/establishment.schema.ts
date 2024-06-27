import { collarSchema } from 'src/collars/schema/collar.schema';
import { z } from 'zod';

export const establishmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  collars: z.array(collarSchema).optional(), // Include collars if necessary
});

const establishmentIdsType = z.object({
  id: z.array(z.string().uuid()),
});

export const establishmentWithCollarsSchema = establishmentSchema.extend({
  establishment: z.union([establishmentIdsType, z.array(collarSchema)]),
});
