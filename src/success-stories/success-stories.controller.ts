import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SuccessStoriesService } from './success-stories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CreateSuccessStoryDto } from './dto/create-success-story.dto';
import { UpdateSuccessStoryDto } from './dto/update-success-story.dto';
import { SuccessStoryDto, SuccessStoriesResponseDto } from './dto/success-story-response.dto';

@Controller('success-stories')
export class SuccessStoriesController {
  constructor(private readonly successStoriesService: SuccessStoriesService) {}

  @Public()
  @Get()
  async getActive(): Promise<SuccessStoriesResponseDto> {
    const stories = await this.successStoriesService.getActive();
    return { stories };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  async getAll(): Promise<SuccessStoriesResponseDto> {
    const stories = await this.successStoriesService.getAll();
    return { stories };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id') id: string): Promise<SuccessStoryDto> {
    return this.successStoriesService.getById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateSuccessStoryDto): Promise<SuccessStoryDto> {
    return this.successStoriesService.create(createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSuccessStoryDto,
  ): Promise<SuccessStoryDto> {
    return this.successStoriesService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.successStoriesService.delete(id);
  }
}

