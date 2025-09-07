import { IsInt } from 'class-validator';
import { BreedsEntity } from 'src/breeds/entities/breed.entity';

export class UpdateBreedsDto {
  @IsInt({ each: true })
  breedsIds: number[];
}
