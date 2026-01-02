import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CourseCategoriesService } from './course-categories.service';
import { CreateCourseCategoryDto } from './dto/create-course-category.dto';
import { UpdateCourseCategoryDto } from './dto/update-course-category.dto';
import { UpdateCourseCategoryOrderDto } from './dto/update-course-category-order.dto';
import { CourseCategoryResponseDto } from './dto/course-category-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('course-categories')
export class CourseCategoriesController {
  constructor(private readonly courseCategoriesService: CourseCategoriesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllCategories(): Promise<CourseCategoryResponseDto[]> {
    return this.courseCategoriesService.getAllCategories();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getCategoryById(@Param('id') id: string): Promise<CourseCategoryResponseDto> {
    return this.courseCategoriesService.getCategoryById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() createCategoryDto: CreateCourseCategoryDto,
  ): Promise<CourseCategoryResponseDto> {
    return this.courseCategoriesService.createCategory(createCategoryDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCourseCategoryDto,
  ): Promise<CourseCategoryResponseDto> {
    return this.courseCategoriesService.updateCategory(id, updateCategoryDto);
  }

  @Patch(':id/order')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateCategoryOrder(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateCourseCategoryOrderDto,
  ): Promise<CourseCategoryResponseDto> {
    return this.courseCategoriesService.updateCategoryOrder(id, updateOrderDto.sortOrder);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string): Promise<void> {
    return this.courseCategoriesService.deleteCategory(id);
  }
}

