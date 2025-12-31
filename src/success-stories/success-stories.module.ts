import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuccessStoriesController } from './success-stories.controller';
import { SuccessStoriesService } from './success-stories.service';
import { SuccessStory } from '../database/entities/success-stories.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SuccessStory])],
  controllers: [SuccessStoriesController],
  providers: [SuccessStoriesService],
  exports: [SuccessStoriesService],
})
export class SuccessStoriesModule {}







