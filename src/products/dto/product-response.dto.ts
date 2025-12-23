import { ProductType } from '../../database/entities/products.entity';

export class CreatorResponseDto {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  avatarUrl?: string;
}

export class PriceResponseDto {
  id: string;
  currency: string;
  amount: number;
  isActive: boolean;
}

export class ProductResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productType: ProductType;
  fileUrl?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  creator: CreatorResponseDto;
  prices: PriceResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}





