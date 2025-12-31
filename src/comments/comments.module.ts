import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from '../database/entities/comments.entity';
import { Content } from '../database/entities/content.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Content])],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}

