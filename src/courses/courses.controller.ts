import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
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
import { CreateContentResourceDto } from './dto/create-content-resource.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateContentStatusDto } from './dto/update-content-status.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpdateContentOrderDto } from './dto/update-content-order.dto';
import { UpdateCourseOrderDto } from './dto/update-course-order.dto';
import { SaveContentProgressDto } from './dto/save-content-progress.dto';
import { MarkContentCompletedDto } from './dto/mark-content-completed.dto';
import { CourseResponseDto, ContentResponseDto, ContentResourceResponseDto, CourseWithContentResponseDto } from './dto/course-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  async getSubscriptionCourses(
    @CurrentUser() user: User,
  ): Promise<CourseWithContentResponseDto[]> {
    return this.coursesService.getSubscriptionCourses(user);
  }

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

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateCourse(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.updateCourse(id, updateCourseDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCourse(
    @Param('id') id: string,
  ): Promise<void> {
    return this.coursesService.deleteCourse(id);
  }

  @Patch(':id/order')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateCourseOrder(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateCourseOrderDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.updateCourseOrder(id, updateOrderDto.sortOrder);
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

  @Patch('content/:contentId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async updateContent(
    @Param('contentId') contentId: string,
    @Body() updateContentDto: UpdateContentDto,
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
    return this.coursesService.updateContent(contentId, updateContentDto, file);
  }

  @Patch('content/:contentId/order')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateContentOrder(
    @Param('contentId') contentId: string,
    @Body() updateOrderDto: UpdateContentOrderDto,
  ): Promise<ContentResponseDto> {
    return this.coursesService.updateContentOrder(contentId, updateOrderDto.sortOrder);
  }

  @Patch('content/:contentId/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateContentStatus(
    @Param('contentId') contentId: string,
    @Body() updateStatusDto: UpdateContentStatusDto,
  ): Promise<ContentResponseDto> {
    return this.coursesService.updateContentStatus(contentId, updateStatusDto.isActive);
  }

  @Delete('content/:contentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContent(
    @Param('contentId') contentId: string,
  ): Promise<void> {
    return this.coursesService.deleteContent(contentId);
  }

  @Post('content/:contentId/resources')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async createContentResource(
    @Param('contentId') contentId: string,
    @Body() createResourceDto: CreateContentResourceDto,
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
  ): Promise<ContentResourceResponseDto> {
    return this.coursesService.createContentResource(contentId, createResourceDto, file);
  }

  @Delete('content/:contentId/resources/:resourceId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContentResource(
    @Param('contentId') contentId: string,
    @Param('resourceId') resourceId: string,
  ): Promise<void> {
    return this.coursesService.deleteContentResource(contentId, resourceId);
  }

  @Post('content/:contentId/progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async saveContentProgress(
    @CurrentUser() user: User,
    @Param('contentId') contentId: string,
    @Body() saveProgressDto: SaveContentProgressDto,
  ): Promise<{ progressSeconds: number; isCompleted: boolean }> {
    return this.coursesService.saveContentProgress(user.id, contentId, saveProgressDto);
  }

  @Get('content/:contentId/progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getContentProgress(
    @CurrentUser() user: User,
    @Param('contentId') contentId: string,
  ): Promise<{ progressSeconds: number; isCompleted: boolean } | null> {
    return this.coursesService.getContentProgress(user.id, contentId);
  }

  @Post('content/:contentId/completed')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markContentCompleted(
    @CurrentUser() user: User,
    @Param('contentId') contentId: string,
    @Body() markCompletedDto: MarkContentCompletedDto,
  ): Promise<{ progressSeconds: number; isCompleted: boolean }> {
    return this.coursesService.markContentCompleted(user.id, contentId, markCompletedDto);
  }

  @Get('course/:courseId/progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCourseProgress(
    @CurrentUser() user: User,
    @Param('courseId') courseId: string,
  ): Promise<Record<string, { progressSeconds: number; isCompleted: boolean }>> {
    const progressMap = await this.coursesService.getUserProgressForCourse(user.id, courseId);
    return Object.fromEntries(progressMap);
  }
}


