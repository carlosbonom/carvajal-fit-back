import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  MinLength,
  MaxLength,
  Min,
  Matches,
  IsUrl,
  IsObject,
} from 'class-validator';
import { CourseLevel } from '../../database/entities/courses.entity';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El título no puede estar vacío' })
  @MaxLength(300, { message: 'El título no puede exceder 300 caracteres' })
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El slug no puede estar vacío' })
  @MaxLength(300, { message: 'El slug no puede exceder 300 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe contener solo letras minúsculas, números y guiones',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({}, { message: 'La URL del thumbnail debe ser válida' })
  @MaxLength(500, { message: 'La URL del thumbnail no puede exceder 500 caracteres' })
  thumbnailUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'La URL del trailer debe ser válida' })
  @MaxLength(500, { message: 'La URL del trailer no puede exceder 500 caracteres' })
  trailerUrl?: string;

  @IsOptional()
  @IsEnum(CourseLevel, {
    message: 'El nivel debe ser uno de: beginner, intermediate, advanced',
  })
  level?: CourseLevel | null;

  @IsOptional()
  @IsInt({ message: 'La duración debe ser un número entero' })
  @Min(0, { message: 'La duración debe ser mayor o igual a 0' })
  durationMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0' })
  sortOrder?: number | null;

  @IsOptional()
  @IsString({ message: 'El ID del creator debe ser una cadena válida' })
  creatorId?: string;

  @IsOptional()
  @IsObject({ message: 'El metadata debe ser un objeto válido' })
  metadata?: Record<string, any>;
}

