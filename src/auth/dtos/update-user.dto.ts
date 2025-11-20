import { IsArray, IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  establishmentIds?: string[];

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsString()
  name?: string;
}

