import { PartialType } from '@nestjs/mapped-types';
import { CreateEstablishmentDto } from './create-establishment.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateEstablishmentDto extends PartialType(CreateEstablishmentDto) {}
