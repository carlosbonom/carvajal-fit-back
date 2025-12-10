import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsUrl,
  MinLength,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { ContentType, AvailabilityType, UnlockType } from '../../database/entities/content.entity';

export class UpdateContentDto {
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
  @IsEnum(ContentType, {
    message: 'El tipo de contenido debe ser uno de: video, image, pdf, document, audio, link, text',
  })
  contentType?: ContentType;

  @IsOptional()
  @IsInt({ message: 'El valor de desbloqueo debe ser un número entero' })
  @Min(0, { message: 'El valor de desbloqueo debe ser mayor o igual a 0' })
  unlockValue?: number;

  @IsOptional()
  @IsEnum(UnlockType, {
    message: 'El tipo de desbloqueo debe ser uno de: immediate, day, week, month, year',
  })
  unlockType?: UnlockType;

  @IsOptional()
  @IsUrl({}, { message: 'La URL del contenido debe ser válida' })
  @MaxLength(500, { message: 'La URL del contenido no puede exceder 500 caracteres' })
  contentUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'La URL del thumbnail debe ser válida' })
  @MaxLength(500, { message: 'La URL del thumbnail no puede exceder 500 caracteres' })
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt({ message: 'La duración debe ser un número entero' })
  @Min(0, { message: 'La duración debe ser mayor o igual a 0' })
  durationSeconds?: number;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0' })
  sortOrder?: number;

  @IsOptional()
  @IsEnum(AvailabilityType, {
    message: 'El tipo de disponibilidad debe ser uno de: none, month, day, week',
  })
  availabilityType?: AvailabilityType;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

