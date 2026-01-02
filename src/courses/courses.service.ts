import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Course } from '../database/entities/courses.entity';
import { Content, ContentType, AvailabilityType, UnlockType } from '../database/entities/content.entity';
import { ContentResource } from '../database/entities/content-resources.entity';
import { Creator } from '../database/entities/creators.entity';
import { UserSubscription, SubscriptionStatus } from '../database/entities/user-subscriptions.entity';
import { User, UserRole } from '../database/entities/users.entity';
import { UserContentProgress } from '../database/entities/user-content-progress.entity';
import { CourseCategory } from '../database/entities/course-categories.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateContentDto } from './dto/create-content.dto';
import { CreateContentResourceDto } from './dto/create-content-resource.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { SaveContentProgressDto } from './dto/save-content-progress.dto';
import { MarkContentCompletedDto } from './dto/mark-content-completed.dto';
import { CourseResponseDto, ContentResponseDto, ContentResourceResponseDto, CourseWithContentResponseDto } from './dto/course-response.dto';
import { FileService } from '../file/file.service';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
    @InjectRepository(ContentResource)
    private readonly contentResourceRepository: Repository<ContentResource>,
    @InjectRepository(Creator)
    private readonly creatorRepository: Repository<Creator>,
    @InjectRepository(UserSubscription)
    private readonly userSubscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(UserContentProgress)
    private readonly userContentProgressRepository: Repository<UserContentProgress>,
    @InjectRepository(CourseCategory)
    private readonly courseCategoryRepository: Repository<CourseCategory>,
    private readonly fileService: FileService,
  ) {}

  async getAllCourses(): Promise<CourseResponseDto[]> {
    const courses = await this.courseRepository.find({
      relations: ['creator', 'category'],
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
      category: course.category
        ? {
            id: course.category.id,
            name: course.category.name,
            slug: course.category.slug,
          }
        : null,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    }));
  }

  async deleteCourse(id: string): Promise<void> {
    const course = await this.courseRepository.findOne({
      where: { id },
    });

    if (!course) {
      throw new NotFoundException(`Curso con ID ${id} no encontrado`);
    }

    try {
      await this.courseRepository.remove(course);
    } catch (error) {
      throw new InternalServerErrorException(
        'No se pudo eliminar el curso. Verifica si tiene contenidos o relaciones asociadas.',
      );
    }
  }

  async getCourseById(id: string): Promise<CourseResponseDto> {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: ['creator', 'category'],
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
      category: course.category
        ? {
            id: course.category.id,
            name: course.category.name,
            slug: course.category.slug,
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
      relations: ['course', 'resources'],
    });

    return contents.map((content) => ({
      id: content.id,
      title: content.title,
      slug: content.slug,
      description: content.description,
      contentType: content.contentType,
      unlockValue: content.unlockValue,
      unlockType: content.unlockType,
      contentUrl: content.contentUrl,
      thumbnailUrl: content.thumbnailUrl,
      durationSeconds: content.durationSeconds,
      sortOrder: content.sortOrder,
      availabilityType: content.availabilityType,
      resources: content.resources?.map((resource) => ({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        resourceUrl: resource.resourceUrl,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      })) || [],
      isPreview: content.isPreview,
      isActive: content.isActive,
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

    // Validar que la categoría existe si se proporciona
    let category: CourseCategory | null = null;
    if (createCourseDto.categoryId) {
      category = await this.courseCategoryRepository.findOne({
        where: { id: createCourseDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException(
          `Categoría con ID ${createCourseDto.categoryId} no encontrada`,
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
      category: category,
    } as DeepPartial<Course>);

    const savedCourse = await this.courseRepository.save(course);

    // Obtener el curso guardado con relaciones
    const courseWithRelations = await this.courseRepository.findOne({
      where: { id: savedCourse.id },
      relations: ['creator', 'category'],
    });

    // Retornar el curso con la información del creator y category
    return {
      id: courseWithRelations!.id,
      title: courseWithRelations!.title,
      slug: courseWithRelations!.slug,
      description: courseWithRelations!.description,
      thumbnailUrl: courseWithRelations!.thumbnailUrl,
      trailerUrl: courseWithRelations!.trailerUrl,
      level: courseWithRelations!.level,
      durationMinutes: courseWithRelations!.durationMinutes,
      isPublished: courseWithRelations!.isPublished,
      publishedAt: courseWithRelations!.publishedAt,
      sortOrder: courseWithRelations!.sortOrder,
      metadata: courseWithRelations!.metadata,
      creator: courseWithRelations!.creator
        ? {
            id: courseWithRelations!.creator.id,
            name: courseWithRelations!.creator.name,
            slug: courseWithRelations!.creator.slug,
          }
        : null,
      category: courseWithRelations!.category
        ? {
            id: courseWithRelations!.category.id,
            name: courseWithRelations!.category.name,
            slug: courseWithRelations!.category.slug,
          }
        : null,
      createdAt: courseWithRelations!.createdAt,
      updatedAt: courseWithRelations!.updatedAt,
    };
  }

  async updateCourseOrder(
    courseId: string,
    sortOrder: number,
  ): Promise<CourseResponseDto> {
    // Validar que el curso existe
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
      relations: ['creator', 'category'],
    });

    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }

    // Actualizar el orden
    course.sortOrder = sortOrder;
    const updatedCourse = await this.courseRepository.save(course);

    // Obtener el curso actualizado con relaciones
    const courseWithRelations = await this.courseRepository.findOne({
      where: { id: updatedCourse.id },
      relations: ['creator', 'category'],
    });

    // Retornar el curso actualizado
    return {
      id: courseWithRelations!.id,
      title: courseWithRelations!.title,
      slug: courseWithRelations!.slug,
      description: courseWithRelations!.description,
      thumbnailUrl: courseWithRelations!.thumbnailUrl,
      trailerUrl: courseWithRelations!.trailerUrl,
      level: courseWithRelations!.level,
      durationMinutes: courseWithRelations!.durationMinutes,
      isPublished: courseWithRelations!.isPublished,
      publishedAt: courseWithRelations!.publishedAt,
      sortOrder: courseWithRelations!.sortOrder,
      metadata: courseWithRelations!.metadata,
      creator: courseWithRelations!.creator
        ? {
            id: courseWithRelations!.creator.id,
            name: courseWithRelations!.creator.name,
            slug: courseWithRelations!.creator.slug,
          }
        : null,
      category: courseWithRelations!.category
        ? {
            id: courseWithRelations!.category.id,
            name: courseWithRelations!.category.name,
            slug: courseWithRelations!.category.slug,
          }
        : null,
      createdAt: courseWithRelations!.createdAt,
      updatedAt: courseWithRelations!.updatedAt,
    };
  }

  async updateCourse(
    id: string,
    updateCourseDto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    // Validar que el curso existe
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: ['creator', 'category'],
    });

    if (!course) {
      throw new NotFoundException(`Curso con ID ${id} no encontrado`);
    }

    // Validar que el slug no esté en uso (solo si se está cambiando)
    if (updateCourseDto.slug && updateCourseDto.slug !== course.slug) {
      const existingCourse = await this.courseRepository.findOne({
        where: { slug: updateCourseDto.slug },
      });

      if (existingCourse) {
        throw new BadRequestException(
          `Ya existe un curso con el slug "${updateCourseDto.slug}"`,
        );
      }
    }

    // Validar que el creator existe si se proporciona
    if (updateCourseDto.creatorId !== undefined) {
      if (updateCourseDto.creatorId) {
        const creator = await this.creatorRepository.findOne({
          where: { id: updateCourseDto.creatorId },
        });

        if (!creator) {
          throw new NotFoundException(
            `Creator con ID ${updateCourseDto.creatorId} no encontrado`,
          );
        }
        course.creator = creator;
      } else {
        course.creator = null;
      }
    }

    // Validar que la categoría existe si se proporciona
    if (updateCourseDto.categoryId !== undefined) {
      if (updateCourseDto.categoryId) {
        const category = await this.courseCategoryRepository.findOne({
          where: { id: updateCourseDto.categoryId },
        });

        if (!category) {
          throw new NotFoundException(
            `Categoría con ID ${updateCourseDto.categoryId} no encontrada`,
          );
        }
        course.category = category;
      } else {
        course.category = null;
      }
    }

    // Actualizar solo los campos proporcionados
    if (updateCourseDto.title !== undefined) course.title = updateCourseDto.title;
    if (updateCourseDto.slug !== undefined) course.slug = updateCourseDto.slug;
    if (updateCourseDto.description !== undefined) course.description = updateCourseDto.description;
    if (updateCourseDto.thumbnailUrl !== undefined) course.thumbnailUrl = updateCourseDto.thumbnailUrl;
    if (updateCourseDto.trailerUrl !== undefined) course.trailerUrl = updateCourseDto.trailerUrl;
    if (updateCourseDto.level !== undefined) course.level = updateCourseDto.level ?? null;
    if (updateCourseDto.durationMinutes !== undefined) course.durationMinutes = updateCourseDto.durationMinutes ?? null;
    if (updateCourseDto.sortOrder !== undefined) course.sortOrder = updateCourseDto.sortOrder ?? 0;
    if (updateCourseDto.metadata !== undefined) course.metadata = updateCourseDto.metadata;
    
    // Manejar isPublished y publishedAt
    if (updateCourseDto.isPublished !== undefined) {
      course.isPublished = updateCourseDto.isPublished;
      // Si se está publicando por primera vez, establecer publishedAt
      if (updateCourseDto.isPublished && !course.publishedAt) {
        course.publishedAt = new Date();
      }
      // Si se está despublicando, limpiar publishedAt
      if (!updateCourseDto.isPublished) {
        course.publishedAt = null;
      }
    }

    const updatedCourse = await this.courseRepository.save(course);

    // Obtener el curso actualizado con relaciones
    const courseWithRelations = await this.courseRepository.findOne({
      where: { id: updatedCourse.id },
      relations: ['creator', 'category'],
    });

    // Retornar el curso actualizado
    return {
      id: courseWithRelations!.id,
      title: courseWithRelations!.title,
      slug: courseWithRelations!.slug,
      description: courseWithRelations!.description,
      thumbnailUrl: courseWithRelations!.thumbnailUrl,
      trailerUrl: courseWithRelations!.trailerUrl,
      level: courseWithRelations!.level,
      durationMinutes: courseWithRelations!.durationMinutes,
      isPublished: courseWithRelations!.isPublished,
      publishedAt: courseWithRelations!.publishedAt,
      sortOrder: courseWithRelations!.sortOrder,
      metadata: courseWithRelations!.metadata,
      creator: courseWithRelations!.creator
        ? {
            id: courseWithRelations!.creator.id,
            name: courseWithRelations!.creator.name,
            slug: courseWithRelations!.creator.slug,
          }
        : null,
      category: courseWithRelations!.category
        ? {
            id: courseWithRelations!.category.id,
            name: courseWithRelations!.category.name,
            slug: courseWithRelations!.category.slug,
          }
        : null,
      createdAt: courseWithRelations!.createdAt,
      updatedAt: courseWithRelations!.updatedAt,
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

    // Validar que el slug no esté en uso en este curso (solo si se proporciona)
    if (createContentDto.slug) {
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
      slug: createContentDto.slug || null,
      description: createContentDto.description || null,
      contentType: createContentDto.contentType,
      unlockValue: createContentDto.unlockValue,
      unlockType: createContentDto.unlockType || UnlockType.IMMEDIATE,
      contentUrl: contentUrl!,
      thumbnailUrl: thumbnailUrl || null,
      durationSeconds: createContentDto.durationSeconds || null,
      sortOrder: createContentDto.sortOrder || 0,
      availabilityType: createContentDto.availabilityType || AvailabilityType.NONE,
      isPreview: createContentDto.isPreview || false,
      course: course,
    } as DeepPartial<Content>);

    const savedContent = await this.contentRepository.save(content);

    // Cargar recursos si existen
    const contentWithResources = await this.contentRepository.findOne({
      where: { id: savedContent.id },
      relations: ['resources'],
    });

    // Retornar el contenido con la información del curso
    return {
      id: savedContent.id,
      title: savedContent.title,
      slug: savedContent.slug,
      description: savedContent.description,
      contentType: savedContent.contentType,
      unlockValue: savedContent.unlockValue,
      unlockType: savedContent.unlockType,
      contentUrl: savedContent.contentUrl,
      thumbnailUrl: savedContent.thumbnailUrl,
      durationSeconds: savedContent.durationSeconds,
      sortOrder: savedContent.sortOrder,
      availabilityType: savedContent.availabilityType,
      resources: contentWithResources?.resources?.map((resource) => ({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        resourceUrl: resource.resourceUrl,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      })) || [],
      isPreview: savedContent.isPreview,
      isActive: savedContent.isActive,
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
      },
      createdAt: savedContent.createdAt,
      updatedAt: savedContent.updatedAt,
    };
  }

  async createContentResource(
    contentId: string,
    createResourceDto: CreateContentResourceDto,
    file?: Express.Multer.File,
  ): Promise<ContentResourceResponseDto> {
    // Validar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      relations: ['course'],
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    // Validar que se proporcione resourceUrl o un archivo
    if (!createResourceDto.resourceUrl && !file) {
      throw new BadRequestException(
        'Debe proporcionar una URL de recurso o subir un archivo',
      );
    }

    let resourceUrl = createResourceDto.resourceUrl;

    // Si se subió un archivo, subirlo al almacenamiento
    if (file) {
      const folder = `courses/${content.course.id}/content/${contentId}/resources`;
      const uploadedUrl = await this.fileService.uploadFile(
        file,
        folder,
        true, // isPublic
      );
      resourceUrl = uploadedUrl;
    }

    if (!resourceUrl) {
      throw new BadRequestException(
        'Debe proporcionar una URL de recurso o subir un archivo',
      );
    }

    // Crear el recurso
    const resource = this.contentResourceRepository.create({
      title: createResourceDto.title,
      description: createResourceDto.description || null,
      resourceUrl: resourceUrl,
      content: content,
    } as DeepPartial<ContentResource>);

    const savedResource = await this.contentResourceRepository.save(resource);

    // Retornar el recurso
    return {
      id: savedResource.id,
      title: savedResource.title,
      description: savedResource.description,
      resourceUrl: savedResource.resourceUrl,
      createdAt: savedResource.createdAt,
      updatedAt: savedResource.updatedAt,
    };
  }

  async deleteContentResource(
    contentId: string,
    resourceId: string,
  ): Promise<void> {
    // Validar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    // Validar que el recurso existe y pertenece al contenido
    const resource = await this.contentResourceRepository.findOne({
      where: {
        id: resourceId,
        content: { id: contentId },
      },
    });

    if (!resource) {
      throw new NotFoundException(
        `Recurso con ID ${resourceId} no encontrado en el contenido especificado`,
      );
    }

    // Eliminar el recurso
    await this.contentResourceRepository.remove(resource);
  }

  async updateContent(
    contentId: string,
    updateContentDto: UpdateContentDto,
    file?: Express.Multer.File,
  ): Promise<ContentResponseDto> {
    // Validar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      relations: ['course', 'resources'],
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    // Validar que el slug no esté en uso en este curso (solo si se está cambiando)
    if (updateContentDto.slug && updateContentDto.slug !== content.slug) {
      const existingContent = await this.contentRepository.findOne({
        where: {
          course: { id: content.course.id },
          slug: updateContentDto.slug,
        },
      });

      if (existingContent) {
        throw new BadRequestException(
          `Ya existe contenido con el slug "${updateContentDto.slug}" en este curso`,
        );
      }
    }

    // Si se subió un archivo, subirlo al almacenamiento
    if (file) {
      const folder = `courses/${content.course.id}/content`;
      const uploadedUrl = await this.fileService.uploadFile(
        file,
        folder,
        true, // isPublic
      );
      updateContentDto.contentUrl = uploadedUrl;

      // Si no se proporcionó thumbnailUrl y el archivo es una imagen, usar la misma URL
      if (!updateContentDto.thumbnailUrl && (updateContentDto.contentType === ContentType.IMAGE || content.contentType === ContentType.IMAGE)) {
        updateContentDto.thumbnailUrl = uploadedUrl;
      }
    }

    // Actualizar solo los campos proporcionados
    if (updateContentDto.title !== undefined) content.title = updateContentDto.title;
    if (updateContentDto.slug !== undefined) content.slug = updateContentDto.slug;
    if (updateContentDto.description !== undefined) content.description = updateContentDto.description;
    if (updateContentDto.contentType !== undefined) content.contentType = updateContentDto.contentType;
    if (updateContentDto.unlockValue !== undefined) content.unlockValue = updateContentDto.unlockValue;
    if (updateContentDto.unlockType !== undefined) content.unlockType = updateContentDto.unlockType;
    if (updateContentDto.contentUrl !== undefined) content.contentUrl = updateContentDto.contentUrl;
    if (updateContentDto.thumbnailUrl !== undefined) content.thumbnailUrl = updateContentDto.thumbnailUrl;
    if (updateContentDto.durationSeconds !== undefined) content.durationSeconds = updateContentDto.durationSeconds;
    if (updateContentDto.sortOrder !== undefined) content.sortOrder = updateContentDto.sortOrder;
    if (updateContentDto.availabilityType !== undefined) content.availabilityType = updateContentDto.availabilityType;
    if (updateContentDto.isPreview !== undefined) content.isPreview = updateContentDto.isPreview;
    if (updateContentDto.isActive !== undefined) content.isActive = updateContentDto.isActive;

    const updatedContent = await this.contentRepository.save(content);

    // Retornar el contenido actualizado
    return {
      id: updatedContent.id,
      title: updatedContent.title,
      slug: updatedContent.slug,
      description: updatedContent.description,
      contentType: updatedContent.contentType,
      unlockValue: updatedContent.unlockValue,
      unlockType: updatedContent.unlockType,
      contentUrl: updatedContent.contentUrl,
      thumbnailUrl: updatedContent.thumbnailUrl,
      durationSeconds: updatedContent.durationSeconds,
      sortOrder: updatedContent.sortOrder,
      availabilityType: updatedContent.availabilityType,
      resources: updatedContent.resources?.map((resource) => ({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        resourceUrl: resource.resourceUrl,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      })) || [],
      isPreview: updatedContent.isPreview,
      isActive: updatedContent.isActive,
      course: {
        id: updatedContent.course.id,
        title: updatedContent.course.title,
        slug: updatedContent.course.slug,
      },
      createdAt: updatedContent.createdAt,
      updatedAt: updatedContent.updatedAt,
    };
  }

  async updateContentOrder(
    contentId: string,
    sortOrder: number,
  ): Promise<ContentResponseDto> {
    // Validar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      relations: ['course', 'resources'],
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    // Actualizar el orden
    content.sortOrder = sortOrder;
    const updatedContent = await this.contentRepository.save(content);

    // Retornar el contenido actualizado
    return {
      id: updatedContent.id,
      title: updatedContent.title,
      slug: updatedContent.slug,
      description: updatedContent.description,
      contentType: updatedContent.contentType,
      unlockValue: updatedContent.unlockValue,
      unlockType: updatedContent.unlockType,
      contentUrl: updatedContent.contentUrl,
      thumbnailUrl: updatedContent.thumbnailUrl,
      durationSeconds: updatedContent.durationSeconds,
      sortOrder: updatedContent.sortOrder,
      availabilityType: updatedContent.availabilityType,
      resources: updatedContent.resources?.map((resource) => ({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        resourceUrl: resource.resourceUrl,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      })) || [],
      isPreview: updatedContent.isPreview,
      isActive: updatedContent.isActive,
      course: {
        id: updatedContent.course.id,
        title: updatedContent.course.title,
        slug: updatedContent.course.slug,
      },
      createdAt: updatedContent.createdAt,
      updatedAt: updatedContent.updatedAt,
    };
  }

  async updateContentStatus(
    contentId: string,
    isActive: boolean,
  ): Promise<ContentResponseDto> {
    // Validar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      relations: ['course', 'resources'],
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    // Actualizar el estado
    content.isActive = isActive;
    const updatedContent = await this.contentRepository.save(content);

    // Retornar el contenido actualizado
    return {
      id: updatedContent.id,
      title: updatedContent.title,
      slug: updatedContent.slug,
      description: updatedContent.description,
      contentType: updatedContent.contentType,
      unlockValue: updatedContent.unlockValue,
      unlockType: updatedContent.unlockType,
      contentUrl: updatedContent.contentUrl,
      thumbnailUrl: updatedContent.thumbnailUrl,
      durationSeconds: updatedContent.durationSeconds,
      sortOrder: updatedContent.sortOrder,
      availabilityType: updatedContent.availabilityType,
      resources: updatedContent.resources?.map((resource) => ({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        resourceUrl: resource.resourceUrl,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      })) || [],
      isPreview: updatedContent.isPreview,
      isActive: updatedContent.isActive,
      course: {
        id: updatedContent.course.id,
        title: updatedContent.course.title,
        slug: updatedContent.course.slug,
      },
      createdAt: updatedContent.createdAt,
      updatedAt: updatedContent.updatedAt,
    };
  }

  async deleteContent(contentId: string): Promise<void> {
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    await this.contentRepository.remove(content);
  }

  async getSubscriptionCourses(user: User): Promise<CourseWithContentResponseDto[]> {
    // Si el usuario es admin o support, no necesita suscripción activa pero respeta isPublished e isActive
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPPORT;
    
    let monthsSinceStart = 0;

    // Solo verificar suscripción si no es admin
    if (!isAdmin) {
      const subscription = await this.userSubscriptionRepository.findOne({
        where: {
          user: { id: user.id },
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (!subscription) {
        throw new ForbiddenException('No tienes una suscripción activa');
      }

      // Calcular el mes de suscripción (meses desde startedAt)
      const now = new Date();
      monthsSinceStart = this.calculateMonthsBetween(subscription.startedAt, now);
    }

    // Todos (incluidos admins) ven solo cursos publicados
    const courses = await this.courseRepository.find({
      where: { isPublished: true },
      relations: ['creator', 'category'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    // Para cada curso, obtener su contenido activo (todos respetan isActive)
    const coursesWithContent = await Promise.all(
      courses.map(async (course) => {
        const contents = await this.contentRepository.find({
          where: {
            course: { id: course.id },
            isActive: true,
          },
          relations: ['resources'],
          order: { sortOrder: 'ASC' },
        });

        // Devolver todos los contenidos (no filtrar por desbloqueo)
        // El frontend se encargará de mostrar cuáles están bloqueados
        const availableContents = contents;

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
          category: course.category
            ? {
                id: course.category.id,
                name: course.category.name,
                slug: course.category.slug,
              }
            : null,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
          // Agregar contenido como propiedad adicional (no está en CourseResponseDto estándar)
          content: availableContents.map((content) => ({
            id: content.id,
            title: content.title,
            slug: content.slug,
            description: content.description,
            contentType: content.contentType,
            unlockValue: content.unlockValue,
            unlockType: content.unlockType,
            contentUrl: content.contentUrl,
            thumbnailUrl: content.thumbnailUrl,
            durationSeconds: content.durationSeconds,
            sortOrder: content.sortOrder,
            availabilityType: content.availabilityType,
            resources: content.resources?.map((resource) => ({
              id: resource.id,
              title: resource.title,
              description: resource.description,
              resourceUrl: resource.resourceUrl,
              createdAt: resource.createdAt,
              updatedAt: resource.updatedAt,
            })) || [],
            isPreview: content.isPreview,
            isActive: content.isActive,
            course: {
              id: course.id,
              title: course.title,
              slug: course.slug,
            },
            createdAt: content.createdAt,
            updatedAt: content.updatedAt,
          })),
        };
      }),
    );

    return coursesWithContent as CourseWithContentResponseDto[];
  }

  private isContentUnlocked(content: Content, monthsSinceStart: number): boolean {
    // Si el tipo de desbloqueo es IMMEDIATE, siempre está disponible
    if (content.unlockType === UnlockType.IMMEDIATE) {
      return true;
    }

    // Calcular el valor de desbloqueo según el tipo
    let unlockThreshold = 0;

    switch (content.unlockType) {
      case UnlockType.DAY:
        // Convertir días a meses aproximados (30 días = 1 mes)
        unlockThreshold = Math.floor(content.unlockValue / 30);
        break;
      case UnlockType.WEEK:
        // Convertir semanas a meses aproximados (4 semanas = 1 mes)
        unlockThreshold = Math.floor(content.unlockValue / 4);
        break;
      case UnlockType.MONTH:
        unlockThreshold = content.unlockValue;
        break;
      case UnlockType.YEAR:
        // Convertir años a meses
        unlockThreshold = content.unlockValue * 12;
        break;
      default:
        return true; // Por defecto, disponible
    }

    // El contenido está desbloqueado si el mes de suscripción es >= al threshold
    return monthsSinceStart >= unlockThreshold;
  }

  private calculateMonthsBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const yearsDiff = end.getFullYear() - start.getFullYear();
    const monthsDiff = end.getMonth() - start.getMonth();
    
    return yearsDiff * 12 + monthsDiff;
  }

  async saveContentProgress(
    userId: string,
    contentId: string,
    saveProgressDto: SaveContentProgressDto,
  ): Promise<{ progressSeconds: number; isCompleted: boolean }> {
    // Verificar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    // Buscar o crear el progreso del usuario
    let progress = await this.userContentProgressRepository.findOne({
      where: {
        user: { id: userId },
        content: { id: contentId },
      },
      relations: ['user', 'content'],
    });

    const now = new Date();
    const progressSeconds = Math.min(saveProgressDto.progressSeconds, saveProgressDto.totalSeconds);
    
    // Determinar si está completado (si ha visto al menos el 90% del video)
    const completionThreshold = saveProgressDto.totalSeconds * 0.9;
    const isCompleted = progressSeconds >= completionThreshold;

    if (progress) {
      // Actualizar progreso existente
      progress.progressSeconds = progressSeconds;
      progress.lastWatchedAt = now;
      progress.watchCount += 1;
      
      if (isCompleted && !progress.isCompleted) {
        progress.isCompleted = true;
        progress.completedAt = now;
      } else if (!isCompleted) {
        progress.isCompleted = false;
        progress.completedAt = null;
      }
    } else {
      // Crear nuevo progreso
      const progressData: DeepPartial<UserContentProgress> = {
        user: { id: userId } as User,
        content: { id: contentId } as Content,
        progressSeconds,
        isCompleted,
        lastWatchedAt: now,
        watchCount: 1,
      };
      if (isCompleted) {
        progressData.completedAt = now;
      }
      progress = this.userContentProgressRepository.create(progressData);
    }

    await this.userContentProgressRepository.save(progress);

    return {
      progressSeconds: progress.progressSeconds,
      isCompleted: progress.isCompleted,
    };
  }

  async getContentProgress(
    userId: string,
    contentId: string,
  ): Promise<{ progressSeconds: number; isCompleted: boolean } | null> {
    const progress = await this.userContentProgressRepository.findOne({
      where: {
        user: { id: userId },
        content: { id: contentId },
      },
    });

    if (!progress) {
      return null;
    }

    return {
      progressSeconds: progress.progressSeconds,
      isCompleted: progress.isCompleted,
    };
  }

  async markContentCompleted(
    userId: string,
    contentId: string,
    markCompletedDto: MarkContentCompletedDto,
  ): Promise<{ progressSeconds: number; isCompleted: boolean }> {
    // Verificar que el contenido existe
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException(`Contenido con ID ${contentId} no encontrado`);
    }

    // Buscar o crear el progreso del usuario
    let progress = await this.userContentProgressRepository.findOne({
      where: {
        user: { id: userId },
        content: { id: contentId },
      },
      relations: ['user', 'content'],
    });

    const now = new Date();

    if (progress) {
      // Actualizar progreso existente
      progress.isCompleted = markCompletedDto.isCompleted;
      if (markCompletedDto.isCompleted) {
        // Si se marca como completado, establecer el progreso al 100%
        progress.progressSeconds = content.durationSeconds || 0;
        if (!progress.completedAt) {
          progress.completedAt = now;
        }
      } else {
        progress.completedAt = null;
      }
      progress.lastWatchedAt = now;
    } else {
      // Crear nuevo progreso
      const progressData: DeepPartial<UserContentProgress> = {
        user: { id: userId } as User,
        content: { id: contentId } as Content,
        progressSeconds: markCompletedDto.isCompleted ? (content.durationSeconds || 0) : 0,
        isCompleted: markCompletedDto.isCompleted,
        lastWatchedAt: now,
        watchCount: 1,
      };
      if (markCompletedDto.isCompleted) {
        progressData.completedAt = now;
      }
      progress = this.userContentProgressRepository.create(progressData);
    }

    await this.userContentProgressRepository.save(progress);

    return {
      progressSeconds: progress.progressSeconds,
      isCompleted: progress.isCompleted,
    };
  }

  async getUserProgressForCourse(
    userId: string,
    courseId: string,
  ): Promise<Map<string, { progressSeconds: number; isCompleted: boolean }>> {
    const progressList = await this.userContentProgressRepository
      .createQueryBuilder('progress')
      .innerJoinAndSelect('progress.content', 'content')
      .where('progress.user.id = :userId', { userId })
      .andWhere('content.course.id = :courseId', { courseId })
      .getMany();

    const progressMap = new Map<string, { progressSeconds: number; isCompleted: boolean }>();
    
    progressList.forEach((progress) => {
      if (progress.content && progress.content.id) {
        progressMap.set(progress.content.id, {
          progressSeconds: progress.progressSeconds,
          isCompleted: progress.isCompleted,
        });
      }
    });

    return progressMap;
  }
}


