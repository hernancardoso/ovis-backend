import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class GetReportDTO {
  @IsNumber()
  @Type(() => Number) // Ensures correct type transformation for `start`
  start: number;

  @IsNumber()
  @Type(() => Number) // Ensures correct type transformation for `start`
  end: number;

  @IsOptional()
  acc?: string;
}
