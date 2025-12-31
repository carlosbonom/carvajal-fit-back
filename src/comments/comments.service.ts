import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Comment } from '../database/entities/comments.entity';
import { Content } from '../database/entities/content.entity';
import { User } from '../database/entities/users.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentResponseDto, UserInfoDto } from './dto/comment-response.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
  ) {}

  private mapToResponseDto(comment: Comment): CommentResponseDto {
    const userInfo: UserInfoDto = {
      id: comment.user.id,
      name: comment.user.name,
      email: comment.user.email,
    };

    return {
      id: comment.id,
      text: comment.text,
      user: userInfo,
      parentId: comment.parent?.id || null,
      replies: comment.replies ? comment.replies.map((reply) => this.mapToResponseDto(reply)) : [],
      isActive: comment.isActive,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  async getCommentsByContentId(contentId: string): Promise<CommentResponseDto[]> {
    // Verificar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    // Obtener solo comentarios principales (sin parent)
    const comments = await this.commentRepository.find({
      where: {
        content: { id: contentId },
        parent: IsNull(),
        isActive: true,
      },
      relations: ['user', 'replies', 'replies.user'],
      order: {
        createdAt: 'DESC',
      },
    });

    // Ordenar respuestas por fecha de creación (más antiguas primero)
    comments.forEach((comment) => {
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.sort((a, b) => 
          a.createdAt.getTime() - b.createdAt.getTime()
        );
        // Filtrar solo respuestas activas
        comment.replies = comment.replies.filter(reply => reply.isActive);
      }
    });

    return comments.map((comment) => this.mapToResponseDto(comment));
  }

  async createComment(
    contentId: string,
    userId: string,
    createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    // Verificar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    let parentComment: Comment | null = null;

    // Si hay un parentId, verificar que existe y que no es una respuesta de otra respuesta
    if (createCommentDto.parentId) {
      parentComment = await this.commentRepository.findOne({
        where: { id: createCommentDto.parentId },
        relations: ['parent', 'content'],
      });

      if (!parentComment) {
        throw new NotFoundException(`Comentario padre con ID ${createCommentDto.parentId} no encontrado`);
      }

      // Verificar que el comentario padre pertenece al mismo contenido
      if (parentComment.content.id !== contentId) {
        throw new BadRequestException('El comentario padre no pertenece al mismo contenido');
      }

      // Verificar que el comentario padre no es una respuesta (solo 1 nivel de profundidad)
      if (parentComment.parent) {
        throw new BadRequestException('No se pueden responder respuestas. Solo se permite un nivel de profundidad.');
      }
    }

    const comment = this.commentRepository.create({
      content: { id: contentId } as Content,
      user: { id: userId } as User,
      text: createCommentDto.text,
      parent: parentComment,
      isActive: true,
    });

    const savedComment = await this.commentRepository.save(comment);

    // Cargar relaciones para la respuesta
    const commentWithRelations = await this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ['user', 'parent', 'replies', 'replies.user'],
    });

    return this.mapToResponseDto(commentWithRelations!);
  }

  async updateComment(
    commentId: string,
    userId: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user', 'parent', 'replies', 'replies.user'],
    });

    if (!comment) {
      throw new NotFoundException(`Comentario con ID ${commentId} no encontrado`);
    }

    // Verificar que el usuario es el dueño del comentario
    if (comment.user.id !== userId) {
      throw new ForbiddenException('No tienes permiso para editar este comentario');
    }

    comment.text = updateCommentDto.text;
    const updatedComment = await this.commentRepository.save(comment);

    return this.mapToResponseDto(updatedComment);
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user', 'replies'],
    });

    if (!comment) {
      throw new NotFoundException(`Comentario con ID ${commentId} no encontrado`);
    }

    // Verificar que el usuario es el dueño del comentario
    if (comment.user.id !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este comentario');
    }

    // Si tiene respuestas, solo desactivar (soft delete)
    // Si no tiene respuestas, eliminar completamente
    if (comment.replies && comment.replies.length > 0) {
      comment.isActive = false;
      comment.text = '[Comentario eliminado]';
      await this.commentRepository.save(comment);
    } else {
      await this.commentRepository.remove(comment);
    }
  }
}

