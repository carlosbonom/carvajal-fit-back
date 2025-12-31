import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from '../database/entities/products.entity';
import { ProductPrice } from '../database/entities/product-prices.entity';
import { Creator } from '../database/entities/creators.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductPrice, Creator]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}






