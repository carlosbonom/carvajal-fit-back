import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  MinLength,
  MaxLength,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '../../database/entities/products.entity';

class PriceDto {
  @IsString()
  currency: string;

  @IsNumber()
  amount: number;
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ProductType)
  productType: ProductType;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  creatorSlug?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDto)
  prices: PriceDto[];

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}

