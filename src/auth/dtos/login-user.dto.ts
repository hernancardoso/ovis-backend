import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class LoginUserDto {
  @IsEmail()
  email: string;

  /* Minimum eight characters, at least one uppercase letter, one lowercase letter, one number, and one special character */

  @IsNotEmpty()
  password: string;
}
