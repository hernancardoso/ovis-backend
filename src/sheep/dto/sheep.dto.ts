import { Expose } from 'class-transformer';
import { BreedReducedDto } from 'src/breeds/dto/breed-reduced.dto';
import { CollarReducedDto } from 'src/collars/dto/collar-reduced.dto';
import { PaddockReducedDto } from 'src/paddocks/dto/paddock-reduced.dto';

export class SheepDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  birth?: Date;

  @Expose()
  breed?: BreedReducedDto;

  @Expose()
  tags: string[];

  @Expose()
  paddock: PaddockReducedDto;

  @Expose()
  collar?: CollarReducedDto | null;
}
