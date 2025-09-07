import { IsString } from 'class-validator';
import { SheepEntity } from 'src/sheep/entities/sheep.entity';

export class PaddockReducedDto {
  id: string;
  name: string;
}
