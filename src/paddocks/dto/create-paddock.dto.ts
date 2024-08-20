import { SheepEntity } from 'src/sheep/entities/sheep.entity';

export class CreatePaddockDto {
  name: string;
  sheepIds?: SheepEntity['id'][];
}
