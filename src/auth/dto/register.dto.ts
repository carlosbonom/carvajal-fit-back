import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  Length,
  IsEnum,
} from 'class-validator';
import { UserRole } from '../../database/entities/users.entity';

export class RegisterDto {
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100, {
    message: 'La contraseña no puede exceder 100 caracteres',
  })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 3, { message: 'El código de país debe tener 2 o 3 caracteres' })
  countryCode?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'La moneda debe tener 3 caracteres (ej: CLP, USD)' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'La moneda debe ser un código de 3 letras mayúsculas (ej: CLP, USD, EUR)',
  })
  preferredCurrency?: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: 'El rol debe ser uno de: customer, admin, support',
  })
  role?: UserRole;
}

