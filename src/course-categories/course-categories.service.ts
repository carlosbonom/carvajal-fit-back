import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { CourseCategory } from '../database/entities/course-categories.entity';
import { CreateCourseCategoryDto } from './dto/create-course-category.dto';
import { UpdateCourseCategoryDto } from './dto/update-course-category.dto';
import { CourseCategoryResponseDto } from './dto/course-category-response.dto';

@Injectable()
export class CourseCategoriesService {
  constructor(
    @InjectRepository(CourseCategory)
    private readonly courseCategoryRepository: Repository<CourseCategory>,
  ) { }

  async getAllCategories(): Promise<CourseCategoryResponseDto[]> {
    const categories = await this.courseCategoryRepository.find({
      relations: ['subcategories', 'parent'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      parentId: category.parentId,
      parent: category.parent ? {
        id: category.parent.id,
        name: category.parent.name,
        slug: category.parent.slug,
        description: category.parent.description,
        sortOrder: category.parent.sortOrder,
        isActive: category.parent.isActive,
        parentId: category.parent.parentId,
        createdAt: category.parent.createdAt,
        updatedAt: category.parent.updatedAt,
      } : undefined,
      subcategories: category.subcategories?.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        sortOrder: sub.sortOrder,
        isActive: sub.isActive,
        parentId: sub.parentId,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));
  }

  async getCategoryById(id: string): Promise<CourseCategoryResponseDto> {
    const category = await this.courseCategoryRepository.findOne({
      where: { id },
      relations: ['subcategories', 'parent'],
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      parentId: category.parentId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async createCategory(
    createCategoryDto: CreateCourseCategoryDto,
  ): Promise<CourseCategoryResponseDto> {
    // Validar que el slug no esté en uso
    const existingCategory = await this.courseCategoryRepository.findOne({
      where: { slug: createCategoryDto.slug },
    });

    if (existingCategory) {
      throw new BadRequestException(
        `Ya existe una categoría con el slug "${createCategoryDto.slug}"`,
      );
    }

    // Validar que la categoría padre existe (si se proporciona)
    if (createCategoryDto.parentId) {
      const parentCategory = await this.courseCategoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });

      if (!parentCategory) {
        throw new BadRequestException(
          `La categoría padre con ID "${createCategoryDto.parentId}" no existe`,
        );
      }
    }

    // Obtener el máximo sortOrder para ponerlo al final
    const maxOrderCategory = await this.courseCategoryRepository.findOne({
      where: {},
      order: { sortOrder: 'DESC' },
    });
    const newSortOrder = maxOrderCategory ? maxOrderCategory.sortOrder + 1 : 0;

    // Crear la categoría
    const category = this.courseCategoryRepository.create({
      name: createCategoryDto.name,
      slug: createCategoryDto.slug,
      description: createCategoryDto.description || null,
      sortOrder: newSortOrder,
      isActive: createCategoryDto.isActive ?? true,
      parentId: createCategoryDto.parentId || null,
    } as DeepPartial<CourseCategory>);

    const savedCategory = await this.courseCategoryRepository.save(category);

    return {
      id: savedCategory.id,
      name: savedCategory.name,
      slug: savedCategory.slug,
      description: savedCategory.description,
      sortOrder: savedCategory.sortOrder,
      isActive: savedCategory.isActive,
      parentId: savedCategory.parentId,
      createdAt: savedCategory.createdAt,
      updatedAt: savedCategory.updatedAt,
    };
  }

  async updateCategory(
    id: string,
    updateCategoryDto: UpdateCourseCategoryDto,
  ): Promise<CourseCategoryResponseDto> {
    // Validar que la categoría existe
    const category = await this.courseCategoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    // Validar que el slug no esté en uso (solo si se está cambiando)
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existingCategory = await this.courseCategoryRepository.findOne({
        where: { slug: updateCategoryDto.slug },
      });

      if (existingCategory) {
        throw new BadRequestException(
          `Ya existe una categoría con el slug "${updateCategoryDto.slug}"`,
        );
      }
    }

    // Validar que la categoría padre existe (si se está cambiando)
    if (updateCategoryDto.parentId !== undefined && updateCategoryDto.parentId !== null) {
      // Prevenir que una categoría sea su propio padre
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException(
          'Una categoría no puede ser su propio padre',
        );
      }

      const parentCategory = await this.courseCategoryRepository.findOne({
        where: { id: updateCategoryDto.parentId },
      });

      if (!parentCategory) {
        throw new BadRequestException(
          `La categoría padre con ID "${updateCategoryDto.parentId}" no existe`,
        );
      }
    }

    // Actualizar solo los campos proporcionados
    if (updateCategoryDto.name !== undefined) category.name = updateCategoryDto.name;
    if (updateCategoryDto.slug !== undefined) category.slug = updateCategoryDto.slug;
    if (updateCategoryDto.description !== undefined) category.description = updateCategoryDto.description;
    if (updateCategoryDto.isActive !== undefined) category.isActive = updateCategoryDto.isActive;
    if (updateCategoryDto.parentId !== undefined) category.parentId = updateCategoryDto.parentId;

    const updatedCategory = await this.courseCategoryRepository.save(category);

    return {
      id: updatedCategory.id,
      name: updatedCategory.name,
      slug: updatedCategory.slug,
      description: updatedCategory.description,
      sortOrder: updatedCategory.sortOrder,
      isActive: updatedCategory.isActive,
      parentId: updatedCategory.parentId,
      createdAt: updatedCategory.createdAt,
      updatedAt: updatedCategory.updatedAt,
    };
  }

  async updateCategoryOrder(
    categoryId: string,
    sortOrder: number,
  ): Promise<CourseCategoryResponseDto> {
    // Validar que la categoría existe
    const category = await this.courseCategoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${categoryId} no encontrada`);
    }

    // Actualizar el orden
    category.sortOrder = sortOrder;
    const updatedCategory = await this.courseCategoryRepository.save(category);

    return {
      id: updatedCategory.id,
      name: updatedCategory.name,
      slug: updatedCategory.slug,
      description: updatedCategory.description,
      sortOrder: updatedCategory.sortOrder,
      isActive: updatedCategory.isActive,
      parentId: updatedCategory.parentId,
      createdAt: updatedCategory.createdAt,
      updatedAt: updatedCategory.updatedAt,
    };
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.courseCategoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    await this.courseCategoryRepository.remove(category);
  }

  async getCategoryBySlug(slug: string): Promise<CourseCategoryResponseDto> {
    const category = await this.courseCategoryRepository.findOne({
      where: { slug },
      relations: ['subcategories', 'parent', 'courses'],
    });

    if (!category) {
      throw new NotFoundException(`Categoría con slug ${slug} no encontrada`);
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      parentId: category.parentId,
      parent: category.parent ? {
        id: category.parent.id,
        name: category.parent.name,
        slug: category.parent.slug,
        description: category.parent.description,
        sortOrder: category.parent.sortOrder,
        isActive: category.parent.isActive,
        parentId: category.parent.parentId,
        createdAt: category.parent.createdAt,
        updatedAt: category.parent.updatedAt,
      } : undefined,
      subcategories: category.subcategories?.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        sortOrder: sub.sortOrder,
        isActive: sub.isActive,
        parentId: sub.parentId,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}

