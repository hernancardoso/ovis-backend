import { PartialType } from '@nestjs/mapped-types';
import { CreatePaddockDto } from './create-paddock.dto';

export class UpdatePaddockDto extends PartialType(CreatePaddockDto) {}
