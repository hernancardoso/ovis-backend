import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { AssignationStatus } from 'src/commons/enums/AssignationStatus.enum';

export class CollarFilterDto {
  @IsOptional()
  @IsString()
  status?: AssignationStatus;
}
