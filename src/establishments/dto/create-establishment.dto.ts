import { IsOptional, IsString } from 'class-validator';

export class CreateEstablishmentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString({ each: true })
  collarIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}
