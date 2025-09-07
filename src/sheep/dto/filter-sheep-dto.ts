import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { AssignationStatus } from 'src/commons/enums/AssignationStatus.enum';

export class SheepFilterDto {
  @IsOptional()
  @IsString()
  status?: AssignationStatus;
}
