import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCollarDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? null : value))
  sheepId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
