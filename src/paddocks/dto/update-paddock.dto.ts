import { PartialType } from '@nestjs/mapped-types';
import { CreatePaddockDto } from './create-paddock.dto';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdatePaddockDto extends PartialType(CreatePaddockDto) {
  @IsOptional()
  @IsString({ each: true })
  sheepIds?: string[];

  @IsOptional()
  @IsArray()
  boundaries?: number[][] | null;
}
