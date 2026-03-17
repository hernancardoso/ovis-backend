import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateShadowDto {
  @IsOptional()
  @IsString()
  shadowName?: string;

  // Full desired object (use null values to delete keys in AWS IoT shadows)
  @IsOptional()
  @IsObject()
  desired?: Record<string, any>;
}
