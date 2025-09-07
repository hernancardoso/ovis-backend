import { Expose } from 'class-transformer';
import { CollarReducedDto } from 'src/collars/dto/collar-reduced.dto';
import { SheepReducedDto } from 'src/sheep/dto/sheep-reduced.dto';

export class SheepCollarDto {
  @Expose()
  id: number;

  @Expose()
  sheep: SheepReducedDto;

  @Expose()
  collar: CollarReducedDto;

  @Expose()
  assignedFrom: Date;

  @Expose()
  assignedUntil?: Date;
}
