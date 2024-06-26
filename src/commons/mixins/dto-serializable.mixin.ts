// common/mixins/dto-serializable.ts
import { ZodSchema } from 'zod';

export abstract class DtoSerializable<Dto> {
  constructor(private schema: ZodSchema<Dto>) {}

  toDto(): Dto {
    return this.schema.parse(this);
  }
}
