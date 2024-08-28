import { Transform } from 'class-transformer';
import { BreedsEntity } from 'src/breeds/entities/breed.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';

export class CreateSheepDto {
  name: string;

  birth: Date;

  @Transform(({ value }) => (value === '' ? undefined : value))
  breedId: BreedsEntity['id'];

  paddockId: PaddockEntity['id'];

  @Transform(({ value }) => (value === '' ? undefined : value))
  collarId: CollarEntity['id'];

  tags: string[];
}
