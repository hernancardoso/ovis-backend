import { IsString } from 'class-validator';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';

export class CreatePaddockDto {
  @IsString()
  name: string;
}
