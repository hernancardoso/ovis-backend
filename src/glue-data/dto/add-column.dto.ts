import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddColumnDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  category?: string;
}
