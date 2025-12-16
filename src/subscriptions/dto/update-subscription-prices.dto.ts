import {
  IsArray,
  IsString,
  IsNumber,
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePriceItemDto {
  @IsUUID('4', { message: 'El ID del ciclo de facturación debe ser un UUID válido' })
  @IsOptional()
  billingCycleId?: string;

  @IsString()
  @IsOptional()
  billingCycleSlug?: string;

  @IsString()
  @IsNotEmpty({ message: 'La moneda es requerida' })
  @Matches(/^[A-Z]{3}$/, { message: 'La moneda debe ser un código de 3 letras (ej: CLP, USD)' })
  currency: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número con máximo 2 decimales' })
  @Min(0, { message: 'El monto debe ser mayor o igual a 0' })
  @IsNotEmpty({ message: 'El monto es requerido' })
  amount: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
  isActive?: boolean;

  // Validación personalizada: debe tener al menos uno de los dos
  // Esto se manejará en el servicio
}

export class UpdateSubscriptionPricesDto {
  @IsUUID('4', { message: 'El ID del plan debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID del plan es requerido' })
  planId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePriceItemDto)
  @IsNotEmpty({ message: 'Debe proporcionar al menos un precio para actualizar' })
  prices: UpdatePriceItemDto[];
}

