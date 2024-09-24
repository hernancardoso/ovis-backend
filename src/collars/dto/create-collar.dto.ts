import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCollarDto {
  @IsString()
  name: string;

  @IsNumber()
  imei: number;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? null : value))
  sheepId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
