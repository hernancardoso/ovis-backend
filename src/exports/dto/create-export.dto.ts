import { IsArray, IsString, IsOptional, IsNumber, IsIn, IsBoolean } from 'class-validator';

export class CreateExportDto {
  @IsArray()
  @IsNumber({}, { each: true })
  collarImeis: number[];

  @IsNumber()
  fromTimestamp: number;

  @IsNumber()
  toTimestamp: number;

  @IsArray()
  @IsString({ each: true })
  columns: string[];

  @IsString()
  @IsIn(['CSV', 'JSON'])
  format: 'CSV' | 'JSON';

  @IsOptional()
  @IsBoolean()
  singleFile?: boolean;
}
