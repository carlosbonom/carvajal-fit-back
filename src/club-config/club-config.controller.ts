import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ClubConfigService } from './club-config.service';
import { UpdateClubConfigDto } from './dto/update-club-config.dto';
import { ClubConfigResponseDto } from './dto/club-config-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/non-admin.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('club-config')
export class ClubConfigController {
  constructor(private readonly clubConfigService: ClubConfigService) {}

  @Get()
  @Public()
  async getConfig(): Promise<ClubConfigResponseDto> {
    return this.clubConfigService.getConfig();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateConfig(
    @Body() updateDto: UpdateClubConfigDto,
  ): Promise<ClubConfigResponseDto> {
    return this.clubConfigService.updateConfig(updateDto);
  }
}

