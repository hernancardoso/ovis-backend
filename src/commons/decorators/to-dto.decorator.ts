import { ZodSchema } from 'zod';

export function ToDto<Dto>(schema: ZodSchema<Dto>) {
  return function (constructor: any) {
    constructor.prototype.toDto = function (): Dto {
      return schema.parse(this);
    };
  };
}
