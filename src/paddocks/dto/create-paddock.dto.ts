import { IsString, IsOptional, IsUUID, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaddockDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  sheepIds?: string[];

  @IsOptional()
  @IsArray()
  boundaries?: number[][] | null;
}
