import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Product, ProductType } from '../database/entities/products.entity';
import { ProductPrice } from '../database/entities/product-prices.entity';
import { Creator } from '../database/entities/creators.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto, CreatorResponseDto, PriceResponseDto } from './dto/product-response.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductPrice)
    private readonly productPriceRepository: Repository<ProductPrice>,
    @InjectRepository(Creator)
    private readonly creatorRepository: Repository<Creator>,
  ) {}

  private mapToResponseDto(product: Product): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      productType: product.productType,
      fileUrl: product.fileUrl,
      thumbnailUrl: product.thumbnailUrl,
      bannerUrl: product.bannerUrl,
      isActive: product.isActive,
      metadata: product.metadata,
      creator: {
        id: product.creator.id,
        name: product.creator.name,
        slug: product.creator.slug,
        bio: product.creator.bio,
        avatarUrl: product.creator.avatarUrl,
      },
      prices: (product as any).prices?.map((price: ProductPrice) => ({
        id: price.id,
        currency: price.currency,
        amount: Number(price.amount),
        isActive: price.isActive,
      })) || [],
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async getProducts(creatorSlug?: string): Promise<ProductResponseDto[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.creator', 'creator')
      .leftJoinAndSelect('product.prices', 'prices');

    if (creatorSlug) {
      queryBuilder.where('creator.slug = :creatorSlug', { creatorSlug });
    }

    const products = await queryBuilder.getMany();
    return products.map((product) => this.mapToResponseDto(product));
  }

  async getProductById(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['creator', 'prices'],
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return this.mapToResponseDto(product);
  }

  async getProductBySlug(slug: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { slug },
      relations: ['creator', 'prices'],
    });

    if (!product) {
      throw new NotFoundException(`Producto con slug ${slug} no encontrado`);
    }

    return this.mapToResponseDto(product);
  }

  async createProduct(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    // Validar que al menos uno de los dos esté presente
    if (!createProductDto.creatorId && !createProductDto.creatorSlug) {
      throw new BadRequestException('Debe proporcionar creatorId o creatorSlug');
    }

    // Verificar que el creator existe
    let creator;
    if (createProductDto.creatorId) {
      creator = await this.creatorRepository.findOne({
        where: { id: createProductDto.creatorId },
      });
    } else if (createProductDto.creatorSlug) {
      creator = await this.creatorRepository.findOne({
        where: { slug: createProductDto.creatorSlug },
      });
    }

    if (!creator) {
      throw new NotFoundException(
        `Creator no encontrado${createProductDto.creatorId ? ` con ID ${createProductDto.creatorId}` : createProductDto.creatorSlug ? ` con slug ${createProductDto.creatorSlug}` : ''}`
      );
    }

    // Verificar que el slug no existe
    const existingProduct = await this.productRepository.findOne({
      where: { slug: createProductDto.slug },
    });

    if (existingProduct) {
      throw new BadRequestException(`Ya existe un producto con el slug ${createProductDto.slug}`);
    }

    // Crear el producto
    const product = this.productRepository.create({
      name: createProductDto.name,
      slug: createProductDto.slug,
      description: createProductDto.description,
      productType: createProductDto.productType,
      creator: creator,
      fileUrl: createProductDto.fileUrl,
      thumbnailUrl: createProductDto.thumbnailUrl,
      bannerUrl: createProductDto.bannerUrl,
      isActive: createProductDto.isActive ?? true,
      metadata: createProductDto.metadata,
    } as DeepPartial<Product>);

    const savedProduct = await this.productRepository.save(product);

    // Crear los precios
    if (createProductDto.prices && createProductDto.prices.length > 0) {
      const prices = createProductDto.prices.map((price) =>
        this.productPriceRepository.create({
          product: savedProduct,
          currency: price.currency,
          amount: price.amount,
          isActive: true,
        }),
      );
      await this.productPriceRepository.save(prices);
    }

    // Cargar el producto con relaciones
    const productWithRelations = await this.productRepository.findOne({
      where: { id: savedProduct.id },
      relations: ['creator', 'prices'],
    });

    return this.mapToResponseDto(productWithRelations!);
  }

  async updateProduct(id: string, updateProductDto: UpdateProductDto): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['creator', 'prices'],
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    // Verificar slug único si se está actualizando
    if (updateProductDto.slug && updateProductDto.slug !== product.slug) {
      const existingProduct = await this.productRepository.findOne({
        where: { slug: updateProductDto.slug },
      });

      if (existingProduct) {
        throw new BadRequestException(`Ya existe un producto con el slug ${updateProductDto.slug}`);
      }
    }

    // Actualizar campos del producto
    Object.assign(product, {
      name: updateProductDto.name ?? product.name,
      slug: updateProductDto.slug ?? product.slug,
      description: updateProductDto.description ?? product.description,
      productType: updateProductDto.productType ?? product.productType,
      fileUrl: updateProductDto.fileUrl ?? product.fileUrl,
      thumbnailUrl: updateProductDto.thumbnailUrl ?? product.thumbnailUrl,
      bannerUrl: updateProductDto.bannerUrl ?? product.bannerUrl,
      isActive: updateProductDto.isActive ?? product.isActive,
      metadata: updateProductDto.metadata ?? product.metadata,
    });

    await this.productRepository.save(product);

    // Actualizar precios si se proporcionan
    if (updateProductDto.prices) {
      // Eliminar precios existentes
      await this.productPriceRepository.delete({ product: { id: product.id } });

      // Crear nuevos precios
      if (updateProductDto.prices.length > 0) {
        const prices = updateProductDto.prices.map((price) =>
          this.productPriceRepository.create({
            product: product,
            currency: price.currency,
            amount: price.amount,
            isActive: true,
          }),
        );
        await this.productPriceRepository.save(prices);
      }
    }

    // Cargar el producto actualizado con relaciones
    const updatedProduct = await this.productRepository.findOne({
      where: { id },
      relations: ['creator', 'prices'],
    });

    return this.mapToResponseDto(updatedProduct!);
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    await this.productRepository.remove(product);
  }
}

