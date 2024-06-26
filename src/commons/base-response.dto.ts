// base-response.dto.ts
import { z } from 'zod';

export const baseResponseSchema = <T>(dataSchema: z.ZodType<T>) =>
  z.object({
    response: dataSchema,
    pagination: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  });

export type BaseResponseDto<T> = {
  response: T;
  pagination?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
  metadata?: Record<string, any>;
};
