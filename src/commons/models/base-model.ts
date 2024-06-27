// common/models/base-model.ts
import { omitZodFields } from 'src/utilities/omitZodFields';
import { ZodObject, ZodRawShape, ZodSchema, z } from 'zod';

export abstract class BaseModel<T, Dto> {
  protected abstract schema: ZodObject<any>;

  constructor(data: Partial<T>) {
    Object.assign(this, data);
  }

  toDto({ omit }: { omit?: string[] } = {}): Dto {
    let schema = this.schema;
    if (omit && omit.length > 0) {
      schema = omitZodFields(schema, omit);
    }
    return schema.parse(this) as Dto;
  }
}
