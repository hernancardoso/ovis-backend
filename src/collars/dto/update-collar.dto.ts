import { PartialType } from '@nestjs/mapped-types';
import { CreateCollarDto } from './create-collar.dto';
import { SheepDto } from 'src/sheep/dto/sheep.dto';

export class UpdateCollarDto extends PartialType(CreateCollarDto) {
    sheep?: SheepDto;
}
