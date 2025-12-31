import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';

@Controller('content')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(':contentId/comments')
  @UseGuards(JwtAuthGuard)
  async getComments(@Param('contentId') contentId: string): Promise<CommentResponseDto[]> {
    return this.commentsService.getCommentsByContentId(contentId);
  }

  @Post(':contentId/comments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @CurrentUser() user: User,
    @Param('contentId') contentId: string,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.createComment(contentId, user.id, createCommentDto);
  }

  @Patch('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateComment(
    @CurrentUser() user: User,
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.updateComment(commentId, user.id, updateCommentDto);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @CurrentUser() user: User,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.commentsService.deleteComment(commentId, user.id);
  }
}

