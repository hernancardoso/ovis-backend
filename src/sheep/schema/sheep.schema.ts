import { z } from 'zod';

export const sheepSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  //age: z.number().int().nonnegative(),
});

export type SheepDto = z.infer<typeof sheepSchema>;
