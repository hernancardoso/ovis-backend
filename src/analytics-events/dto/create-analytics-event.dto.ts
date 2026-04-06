import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreateAnalyticsEventDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsOptional()
  imei?: string | number; // Accept numbers and convert to string in service

  @IsString()
  @IsOptional()
  message?: string;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsString()
  @IsOptional()
  severity?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
