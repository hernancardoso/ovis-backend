import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateFotaDeploymentDto {
  @IsString()
  @IsNotEmpty()
  firmwareArtifactId: string;

  @IsArray()
  @ArrayMinSize(1)
  collarIds: string[];
}

