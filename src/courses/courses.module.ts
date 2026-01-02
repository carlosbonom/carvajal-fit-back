import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course } from '../database/entities/courses.entity';
import { Content } from '../database/entities/content.entity';
import { ContentResource } from '../database/entities/content-resources.entity';
import { Creator } from '../database/entities/creators.entity';
import { UserSubscription, SubscriptionStatus } from '../database/entities/user-subscriptions.entity';
import { UserContentProgress } from '../database/entities/user-content-progress.entity';
import { CourseCategory } from '../database/entities/course-categories.entity';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Content, ContentResource, Creator, UserSubscription, UserContentProgress, CourseCategory]),
    FileModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}


