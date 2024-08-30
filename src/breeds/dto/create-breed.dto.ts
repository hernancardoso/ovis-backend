import { IsString } from 'class-validator';

export class CreateBreedDto {
  @IsString()
  name: string;
}
