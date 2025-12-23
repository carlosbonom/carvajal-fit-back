import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubConfig } from '../database/entities/club-config.entity';
import { UpdateClubConfigDto } from './dto/update-club-config.dto';
import { ClubConfigResponseDto } from './dto/club-config-response.dto';

@Injectable()
export class ClubConfigService {
  constructor(
    @InjectRepository(ClubConfig)
    private readonly clubConfigRepository: Repository<ClubConfig>,
  ) {}

  async getConfig(): Promise<ClubConfigResponseDto> {
    let config = await this.clubConfigRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    // Si no existe configuración, crear una por defecto
    if (!config) {
      config = this.clubConfigRepository.create({
        whatsappLink: null,
        nextMeetingDateTime: null,
        meetingLink: null,
      });
      config = await this.clubConfigRepository.save(config);
    }

    return this.mapToResponseDto(config);
  }

  async updateConfig(updateDto: UpdateClubConfigDto): Promise<ClubConfigResponseDto> {
    let config = await this.clubConfigRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (!config) {
      config = this.clubConfigRepository.create({
        whatsappLink: updateDto.whatsappLink || null,
        nextMeetingDateTime: updateDto.nextMeetingDateTime
          ? new Date(updateDto.nextMeetingDateTime)
          : null,
        meetingLink: updateDto.meetingLink || null,
      });
    } else {
      if (updateDto.whatsappLink !== undefined) {
        config.whatsappLink = updateDto.whatsappLink || null;
      }
      if (updateDto.nextMeetingDateTime !== undefined) {
        config.nextMeetingDateTime = updateDto.nextMeetingDateTime
          ? new Date(updateDto.nextMeetingDateTime)
          : null;
      }
      if (updateDto.meetingLink !== undefined) {
        config.meetingLink = updateDto.meetingLink || null;
      }
    }

    config = await this.clubConfigRepository.save(config);
    return this.mapToResponseDto(config);
  }

  private mapToResponseDto(config: ClubConfig): ClubConfigResponseDto {
    // Formatear datetime para el frontend (formato datetime-local: YYYY-MM-DDTHH:mm)
    let formattedDateTime: string | null = null;
    if (config.nextMeetingDateTime) {
      const date = new Date(config.nextMeetingDateTime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    return {
      id: config.id,
      whatsappLink: config.whatsappLink,
      nextMeetingDateTime: formattedDateTime,
      meetingLink: config.meetingLink,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }
}

