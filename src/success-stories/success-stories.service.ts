import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuccessStory } from '../database/entities/success-stories.entity';
import { CreateSuccessStoryDto } from './dto/create-success-story.dto';
import { UpdateSuccessStoryDto } from './dto/update-success-story.dto';
import { SuccessStoryDto } from './dto/success-story-response.dto';

@Injectable()
export class SuccessStoriesService {
  constructor(
    @InjectRepository(SuccessStory)
    private readonly successStoryRepository: Repository<SuccessStory>,
  ) {}

  async getAll(): Promise<SuccessStoryDto[]> {
    const stories = await this.successStoryRepository.find({
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    return stories.map((story) => this.toDto(story));
  }

  async getActive(): Promise<SuccessStoryDto[]> {
    const stories = await this.successStoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    return stories.map((story) => this.toDto(story));
  }

  async getById(id: string): Promise<SuccessStoryDto> {
    const story = await this.successStoryRepository.findOne({
      where: { id },
    });

    if (!story) {
      throw new NotFoundException(`Caso de éxito con ID ${id} no encontrado`);
    }

    return this.toDto(story);
  }

  async create(createDto: CreateSuccessStoryDto): Promise<SuccessStoryDto> {
    const story = this.successStoryRepository.create({
      name: createDto.name,
      description: createDto.description ?? null,
      imageUrl: createDto.imageUrl,
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
      sortOrder: createDto.sortOrder ?? 0,
    });

    const saved = await this.successStoryRepository.save(story);
    return this.toDto(saved);
  }

  async update(
    id: string,
    updateDto: UpdateSuccessStoryDto,
  ): Promise<SuccessStoryDto> {
    const story = await this.successStoryRepository.findOne({
      where: { id },
    });

    if (!story) {
      throw new NotFoundException(`Caso de éxito con ID ${id} no encontrado`);
    }

    Object.assign(story, updateDto);
    const updated = await this.successStoryRepository.save(story);
    return this.toDto(updated);
  }

  async delete(id: string): Promise<void> {
    const story = await this.successStoryRepository.findOne({
      where: { id },
    });

    if (!story) {
      throw new NotFoundException(`Caso de éxito con ID ${id} no encontrado`);
    }

    await this.successStoryRepository.remove(story);
  }

  private toDto(story: SuccessStory): SuccessStoryDto {
    return {
      id: story.id,
      name: story.name,
      description: story.description,
      imageUrl: story.imageUrl,
      isActive: story.isActive,
      sortOrder: story.sortOrder,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }
}

