import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'El email debe ser una dirección de correo válida' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;
}






