import { IsString, IsOptional, IsUUID } from 'class-validator';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';

export class CreatePaddockDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  sheepIds?: string[];
}
