import { IsString, MinLength, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class VerifyPasswordChangeDto {
  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser válido' })
  email?: string;

  @IsString()
  @IsNotEmpty({ message: 'El código es requerido' })
  code: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  newPassword: string;
}

