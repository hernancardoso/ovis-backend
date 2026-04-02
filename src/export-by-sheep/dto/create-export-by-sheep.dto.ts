import { IsArray, IsNumber, IsString, IsUUID } from 'class-validator';

export class CreateExportBySheepDto {
  @IsArray()
  @IsUUID('4', { each: true })
  sheepIds: string[];

  @IsNumber()
  fromTimestamp: number;

  @IsNumber()
  toTimestamp: number;

  @IsArray()
  @IsString({ each: true })
  columns: string[];
}
