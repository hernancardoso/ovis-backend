// collar.schema.ts
import { z } from 'zod';
import { sheepSchema } from 'src/sheep/schema/sheep.schema';
import { establishmentSchema } from 'src/establishments/schemas/establishment.schema';

export const collarBaseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().max(255),
    establishment: establishmentSchema.omit({ collars: true }).optional(), // Avoid circular reference
    establishmentId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      if (!data.establishment && !data.establishmentId) {
        return false;
      }
      return true;
    },
    {
      message: 'establishmentId is required if establishment is not present',
      path: ['establishmentId'],
    }
  );

export const collarWithSheepSchema = collarBaseSchema.extend({
  sheep: sheepSchema.optional(), // Optional reference to the full Sheep object
});

// Collar schema that can accept either just the sheepId or the full Sheep object
export const collarSchema = z.union([collarBaseSchema, collarWithSheepSchema]);
