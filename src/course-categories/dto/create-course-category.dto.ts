import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class CreateCourseCategoryDto {
  @IsString()
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsString()
  @MinLength(1, { message: 'El slug no puede estar vacío' })
  @MaxLength(100, { message: 'El slug no puede exceder 100 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe contener solo letras minúsculas, números y guiones',
  })
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'El ID de la categoría padre debe ser un UUID válido' })
  parentId?: string;
}

