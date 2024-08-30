import { plainToInstance } from 'class-transformer';

type Constructor<T> = new (...args: any[]) => T;

export class BaseService {
  protected toDto<T extends object, E extends object>(dtoClass: Constructor<T>, entity: E, customValues: Partial<T> = {}): T {
    const dto = plainToInstance(dtoClass, entity, { excludeExtraneousValues: true });

    return Object.assign(dto, customValues) as T;
  }
}
