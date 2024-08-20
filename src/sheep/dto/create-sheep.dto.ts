import { BreedsEntity } from 'src/breeds/entities/breed.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';

export class CreateSheepDto {
  name: string;
  birth: Date;
  breedId: BreedsEntity['id'];
  paddockId: PaddockEntity['id'];
  collarId: CollarEntity['id'];
  tags: string[];
}
