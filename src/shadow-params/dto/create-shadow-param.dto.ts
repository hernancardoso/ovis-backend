import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ShadowParamType } from '../entities/shadow-param.entity';

export class CreateShadowParamDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsEnum(ShadowParamType)
  @IsNotEmpty()
  type: ShadowParamType;

  @IsString()
  @IsOptional()
  description?: string;
}
