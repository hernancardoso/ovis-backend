import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, IsNumber } from 'class-validator';

export class GetInitialFilterDto {
  @Type(() => Number)
  @IsNumber()
  limit: number;
}
