import { ZodObject, ZodRawShape, z } from 'zod';

export function omitZodFields<T extends ZodRawShape, K extends keyof T>(
  schema: ZodObject<T>,
  fields: K[]
): ZodObject<Omit<T, K>> {
  const newShape = { ...schema.shape };
  fields.forEach((field) => delete newShape[field]);
  return z.object(newShape as Omit<T, K>);
}
