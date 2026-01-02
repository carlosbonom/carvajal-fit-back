import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

