import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateEstablishmentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString({ each: true })
  collarIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  onlineThresholdHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  staleThresholdHours?: number;
}
