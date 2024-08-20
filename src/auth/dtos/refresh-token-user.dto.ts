import { IsString } from 'class-validator';

export class RefreshTokenUserDto {
  @IsString()
  refreshToken: string;
}
