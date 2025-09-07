import { CollarDto } from 'src/collars/dto/collar.dto';
import { SheepDto } from 'src/sheep/schema/sheep.schema';

export class UnassignCollarToSheepDto {
  collarId: CollarDto['id'];
  sheepId: SheepDto['id'];
}
