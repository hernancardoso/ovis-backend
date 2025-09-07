import { IsUUID } from 'class-validator';
import { CollarDto } from 'src/collars/dto/collar.dto';
import { SheepDto } from 'src/sheep/schema/sheep.schema';

export class AssignCollarToSheepDto {
  @IsUUID()
  collarId: CollarDto['id'];
  sheepId: SheepDto['id'];
  assignedFrom?: Date;
}
