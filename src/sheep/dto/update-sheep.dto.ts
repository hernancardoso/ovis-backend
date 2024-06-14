import { PartialType } from '@nestjs/mapped-types';
import { CreateSheepDto } from './create-sheep.dto';

export class UpdateSheepDto extends PartialType(CreateSheepDto) {}
