import { IsEmail, IsString, IsArray, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[$&+,:;=?@#|'<>.^*()%!-])[A-Za-z\d@$&+,:;=?@#|'<>.^*()%!-]{8,}$/, {
    message: 'invalid password',
  })
  password: string;

  @IsArray()
  @IsString({ each: true })
  establishmentIds: string[];

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}

