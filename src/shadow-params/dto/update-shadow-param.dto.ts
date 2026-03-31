import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ShadowParamType } from '../entities/shadow-param.entity';

export class UpdateShadowParamDto {
  @IsEnum(ShadowParamType)
  @IsOptional()
  type?: ShadowParamType;

  @IsString()
  @IsOptional()
  description?: string;
}
