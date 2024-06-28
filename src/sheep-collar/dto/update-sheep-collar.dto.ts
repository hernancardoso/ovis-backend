import { PartialType } from '@nestjs/mapped-types';
import { CreateSheepCollarDto } from './create-sheep-collar.dto';

export class UpdateSheepCollarDto extends PartialType(CreateSheepCollarDto) {}
