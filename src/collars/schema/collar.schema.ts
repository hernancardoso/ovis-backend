// collar.schema.ts
import { z } from 'zod';
import { sheepSchema } from 'src/sheep/schema/sheep.schema';

export const collarBaseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().max(255),
});

export const collarWithSheepSchema = collarBaseSchema.extend({
  sheep: sheepSchema.optional(), // Optional reference to the full Sheep object
});

// Collar schema that can accept either just the sheepId or the full Sheep object
export const collarSchema = z.union([collarBaseSchema, collarWithSheepSchema]);
