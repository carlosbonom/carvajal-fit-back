import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateContentDto } from './dto/create-content.dto';
import { CourseResponseDto, ContentResponseDto } from './dto/course-response.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllCourses(): Promise<CourseResponseDto[]> {
    return this.coursesService.getAllCourses();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCourse(
    @Body() createCourseDto: CreateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.createCourse(createCourseDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getCourse(@Param('id') id: string): Promise<CourseResponseDto> {
    return this.coursesService.getCourseById(id);
  }

  @Get(':id/content')
  @UseGuards(JwtAuthGuard)
  async getCourseContent(
    @Param('id') courseId: string,
  ): Promise<ContentResponseDto[]> {
    return this.coursesService.getCourseContent(courseId);
  }

  @Post(':id/content')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async createContent(
    @Param('id') courseId: string,
    @Body() createContentDto: CreateContentDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }), // 100MB
          new FileTypeValidator({ 
            fileType: /^(video|image|application|audio|text)\// 
          }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ): Promise<ContentResponseDto> {
    return this.coursesService.createContent(courseId, createContentDto, file);
  }
}


