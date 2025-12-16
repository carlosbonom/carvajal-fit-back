import {
  IsString,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateContentResourceDto {
  @IsString()
  @MinLength(1, { message: 'El título no puede estar vacío' })
  @MaxLength(300, { message: 'El título no puede exceder 300 caracteres' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl({}, { message: 'La URL del recurso debe ser válida' })
  @IsOptional()
  @MaxLength(500, { message: 'La URL del recurso no puede exceder 500 caracteres' })
  resourceUrl?: string;
}

