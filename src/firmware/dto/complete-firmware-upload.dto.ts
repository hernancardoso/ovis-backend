import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteFirmwareUploadDto {
  @IsString()
  @IsOptional()
  @MaxLength(64)
  sha256?: string;
}

