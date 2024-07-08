import { BreedsEntity } from 'src/breeds/entities/breed.entity';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';

export class CreateSheepDto {
  name: string;
  breedId: BreedsEntity['id'];
  paddockId: PaddockEntity['id'];
}
