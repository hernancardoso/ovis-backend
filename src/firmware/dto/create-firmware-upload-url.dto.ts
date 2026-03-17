import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFirmwareUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  version: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  fileName: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  sha256?: string;
}

