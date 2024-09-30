import { SheepEntity } from '../entities/sheep.entity';
import { SheepReducedDto } from './sheep-reduced.dto';

export type SheepReducedWithTagsDto = Pick<SheepEntity, 'id' | 'name' | 'tags'>;
