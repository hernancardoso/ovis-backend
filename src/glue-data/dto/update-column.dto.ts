import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateColumnDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  // Permite '' para "limpiar" el comentario si el front lo envía vacío.
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
