import { IsArray, IsString, IsNumber } from 'class-validator';

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
}
