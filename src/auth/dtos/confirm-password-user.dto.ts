import { IsEmail, IsString, Matches } from 'class-validator';

export class ConfirmPasswordUserDto {
  @IsEmail()
  email: string;

  @IsString()
  confirmationCode: string;

  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[$&+,:;=?@#|'<>.^*()%!-])[A-Za-z\d@$&+,:;=?@#|'<>.^*()%!-]{8,}$/, {
    message: 'invalid password',
  })
  newPassword: string;
}
