import { IsString, IsDate, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';
import { BreedsEntity } from 'src/breeds/entities/breed.entity';
import { CollarEntity } from 'src/collars/entities/collar.entity';

export class CreateSheepDto {
  @IsString()
  name: string;

  @IsString()
  birth: Date;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  breedId: BreedsEntity['id'];

  @IsUUID()
  paddockId: PaddockEntity['id'];

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? null : value))
  collarId: CollarEntity['id'];

  @IsOptional()
  @IsString({ each: true })
  tags: string[];
}
