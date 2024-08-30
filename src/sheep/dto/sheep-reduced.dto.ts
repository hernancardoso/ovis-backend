import { SheepEntity } from '../entities/sheep.entity';

export type SheepReducedDto = Pick<SheepEntity, 'id' | 'name'>;
