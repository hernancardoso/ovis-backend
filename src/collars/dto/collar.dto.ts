import { Expose } from 'class-transformer';
import { SheepReducedDto } from 'src/sheep/dto/sheep-reduced.dto';

export class CollarDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  isActive: boolean;

  @Expose()
  sheep: SheepReducedDto | null;
}
