import { PartialType } from '@nestjs/mapped-types';
import { CreateCollarDto } from './create-collar.dto';

export class UpdateCollarDto extends PartialType(CreateCollarDto) {}
