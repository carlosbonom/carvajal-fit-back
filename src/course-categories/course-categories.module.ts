import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseCategoriesController } from './course-categories.controller';
import { CourseCategoriesService } from './course-categories.service';
import { CourseCategory } from '../database/entities/course-categories.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseCategory]),
  ],
  controllers: [CourseCategoriesController],
  providers: [CourseCategoriesService],
  exports: [CourseCategoriesService],
})
export class CourseCategoriesModule {}

