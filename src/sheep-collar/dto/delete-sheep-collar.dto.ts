import { IsUUID, IsDateString, IsOptional } from 'class-validator';

export class DeleteSheepCollarDto {
  @IsUUID()
  collarId: string;

  @IsUUID()
  sheepId: string;

  @IsDateString()
  assignedFrom: string; // Will be converted to Date in service

  @IsOptional()
  @IsDateString()
  assignedUntil?: string; // Will be converted to Date in service, can be null
}

