// collar.schema.ts
import { z } from 'zod';
import { sheepSchema } from 'src/sheep/schema/sheep.schema';
import { establishmentSchema } from 'src/establishments/schemas/establishment.schema';

export const collarBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(255),
  establishmentId: z.string().uuid().optional(),
});

export const collarWithSheepSchema = collarBaseSchema.extend({
  sheep: sheepSchema.optional(), // Optional reference to the full Sheep object
});

// Collar schema that can accept either just the sheepId or the full Sheep object
export const collarSchema = z.union([collarBaseSchema, collarWithSheepSchema]);
