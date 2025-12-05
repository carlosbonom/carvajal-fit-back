import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Course } from '../database/entities/courses.entity';
import { Content, ContentType } from '../database/entities/content.entity';
import { Creator } from '../database/entities/creators.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateContentDto } from './dto/create-content.dto';
import { CourseResponseDto, ContentResponseDto } from './dto/course-response.dto';
import { FileService } from '../file/file.service';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
    @InjectRepository(Creator)
    private readonly creatorRepository: Repository<Creator>,
    private readonly fileService: FileService,
  ) {}

  async getAllCourses(): Promise<CourseResponseDto[]> {
    const courses = await this.courseRepository.find({
      relations: ['creator'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    return courses.map((course) => ({
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      trailerUrl: course.trailerUrl,
      level: course.level,
      durationMinutes: course.durationMinutes,
      isPublished: course.isPublished,
      publishedAt: course.publishedAt,
      sortOrder: course.sortOrder,
      metadata: course.metadata,
      creator: course.creator
        ? {
            id: course.creator.id,
            name: course.creator.name,
            slug: course.creator.slug,
          }
        : null,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    }));
  }

  async getCourseById(id: string): Promise<CourseResponseDto> {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!course) {
      throw new NotFoundException(`Curso con ID ${id} no encontrado`);
    }

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      trailerUrl: course.trailerUrl,
      level: course.level,
      durationMinutes: course.durationMinutes,
      isPublished: course.isPublished,
      publishedAt: course.publishedAt,
      sortOrder: course.sortOrder,
      metadata: course.metadata,
      creator: course.creator
        ? {
            id: course.creator.id,
            name: course.creator.name,
            slug: course.creator.slug,
          }
        : null,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }

  async getCourseContent(courseId: string): Promise<ContentResponseDto[]> {
    // Validar que el curso existe
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }

    // Obtener todo el contenido del curso ordenado por sortOrder
    const contents = await this.contentRepository.find({
      where: { course: { id: courseId } },
      order: { sortOrder: 'ASC' },
      relations: ['course'],
    });

    return contents.map((content) => ({
      id: content.id,
      title: content.title,
      slug: content.slug,
      description: content.description,
      contentType: content.contentType,
      unlockMonth: content.unlockMonth,
      contentUrl: content.contentUrl,
      thumbnailUrl: content.thumbnailUrl,
      durationSeconds: content.durationSeconds,
      sortOrder: content.sortOrder,
      hasResources: content.hasResources,
      resourcesUrl: content.resourcesUrl,
      isPreview: content.isPreview,
      course: {
        id: content.course.id,
        title: content.course.title,
        slug: content.course.slug,
      },
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    }));
  }

  async createCourse(createCourseDto: CreateCourseDto): Promise<CourseResponseDto> {
    // Validar que el creator existe si se proporciona
    let creator: Creator | null = null;
    if (createCourseDto.creatorId) {
      creator = await this.creatorRepository.findOne({
        where: { id: createCourseDto.creatorId },
      });

      if (!creator) {
        throw new NotFoundException(
          `Creator con ID ${createCourseDto.creatorId} no encontrado`,
        );
      }
    }

    // Validar que el slug no esté en uso
    const existingCourse = await this.courseRepository.findOne({
      where: { slug: createCourseDto.slug },
    });

    if (existingCourse) {
      throw new BadRequestException(
        `Ya existe un curso con el slug "${createCourseDto.slug}"`,
      );
    }

    // Crear el curso
    const course = this.courseRepository.create({
      title: createCourseDto.title,
      slug: createCourseDto.slug,
      description: createCourseDto.description || null,
      thumbnailUrl: createCourseDto.thumbnailUrl || null,
      trailerUrl: createCourseDto.trailerUrl || null,
      level: createCourseDto.level ?? null,
      durationMinutes: createCourseDto.durationMinutes ?? null,
      isPublished: createCourseDto.isPublished ?? false,
      publishedAt: createCourseDto.isPublished ? new Date() : null,
      sortOrder: createCourseDto.sortOrder ?? 0,
      creator: creator,
    } as DeepPartial<Course>);

    const savedCourse = await this.courseRepository.save(course);

    // Retornar el curso con la información del creator
    return {
      id: savedCourse.id,
      title: savedCourse.title,
      slug: savedCourse.slug,
      description: savedCourse.description,
      thumbnailUrl: savedCourse.thumbnailUrl,
      trailerUrl: savedCourse.trailerUrl,
      level: savedCourse.level,
      durationMinutes: savedCourse.durationMinutes,
      isPublished: savedCourse.isPublished,
      publishedAt: savedCourse.publishedAt,
      sortOrder: savedCourse.sortOrder,
      metadata: savedCourse.metadata,
      creator: savedCourse.creator
        ? {
            id: savedCourse.creator.id,
            name: savedCourse.creator.name,
            slug: savedCourse.creator.slug,
          }
        : null,
      createdAt: savedCourse.createdAt,
      updatedAt: savedCourse.updatedAt,
    };
  }

  async createContent(
    courseId: string,
    createContentDto: CreateContentDto,
    file?: Express.Multer.File,
  ): Promise<ContentResponseDto> {
    // Validar que el curso existe
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
      relations: ['creator'],
    });

    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }

    // Validar que el slug no esté en uso en este curso
    const existingContent = await this.contentRepository.findOne({
      where: {
        course: { id: courseId },
        slug: createContentDto.slug,
      },
    });

    if (existingContent) {
      throw new BadRequestException(
        `Ya existe contenido con el slug "${createContentDto.slug}" en este curso`,
      );
    }

    // Validar que se proporcione contentUrl o un archivo
    if (!createContentDto.contentUrl && !file) {
      throw new BadRequestException(
        'Debe proporcionar una URL de contenido o subir un archivo',
      );
    }

    let contentUrl = createContentDto.contentUrl;
    let thumbnailUrl = createContentDto.thumbnailUrl;

    // Si se subió un archivo, subirlo al almacenamiento
    if (file) {
      const folder = `courses/${courseId}/content`;
      const uploadedUrl = await this.fileService.uploadFile(
        file,
        folder,
        true, // isPublic
      );
      contentUrl = uploadedUrl;

      // Si no se proporcionó thumbnailUrl y el archivo es una imagen, usar la misma URL
      if (!thumbnailUrl && createContentDto.contentType === ContentType.IMAGE) {
        thumbnailUrl = uploadedUrl;
      }
    }

    // Crear el contenido
    const content = this.contentRepository.create({
      title: createContentDto.title,
      slug: createContentDto.slug,
      description: createContentDto.description || null,
      contentType: createContentDto.contentType,
      unlockMonth: createContentDto.unlockMonth,
      contentUrl: contentUrl!,
      thumbnailUrl: thumbnailUrl || null,
      durationSeconds: createContentDto.durationSeconds || null,
      sortOrder: createContentDto.sortOrder || 0,
      hasResources: createContentDto.hasResources || false,
      resourcesUrl: createContentDto.resourcesUrl || null,
      isPreview: createContentDto.isPreview || false,
      course: course,
    } as DeepPartial<Content>);

    const savedContent = await this.contentRepository.save(content);

    // Retornar el contenido con la información del curso
    return {
      id: savedContent.id,
      title: savedContent.title,
      slug: savedContent.slug,
      description: savedContent.description,
      contentType: savedContent.contentType,
      unlockMonth: savedContent.unlockMonth,
      contentUrl: savedContent.contentUrl,
      thumbnailUrl: savedContent.thumbnailUrl,
      durationSeconds: savedContent.durationSeconds,
      sortOrder: savedContent.sortOrder,
      hasResources: savedContent.hasResources,
      resourcesUrl: savedContent.resourcesUrl,
      isPreview: savedContent.isPreview,
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
      },
      createdAt: savedContent.createdAt,
      updatedAt: savedContent.updatedAt,
    };
  }
}


