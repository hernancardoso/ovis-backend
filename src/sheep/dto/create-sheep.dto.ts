import { PaddockEntity } from 'src/paddocks/entities/paddock.entity';

export class CreateSheepDto {
  name: string;
  paddockId: PaddockEntity['id'];
}
