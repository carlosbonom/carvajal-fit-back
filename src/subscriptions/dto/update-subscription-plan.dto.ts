import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El slug no puede estar vacío' })
  @MaxLength(255, { message: 'El slug no puede exceder 255 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe contener solo letras minúsculas, números y guiones',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Cada feature debe ser una cadena de texto' })
  features?: string[];

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0' })
  sortOrder?: number;
}










