import { IsArray, IsString, IsOptional, IsDateString, IsNumber, IsIn } from 'class-validator';

export class CreateExportDto {
  @IsArray()
  @IsNumber({}, { each: true })
  collarImeis: number[];

  @IsString()
  @IsDateString()
  from: string;

  @IsString()
  @IsDateString()
  to: string;

  @IsOptional()
  @IsString()
  fromTime?: string;

  @IsOptional()
  @IsString()
  toTime?: string;

  @IsArray()
  @IsString({ each: true })
  columns: string[];

  @IsString()
  @IsIn(['CSV', 'JSON'])
  format: 'CSV' | 'JSON';
}

