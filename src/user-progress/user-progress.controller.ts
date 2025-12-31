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
import { UserProgressService } from './user-progress.service';
import { CreateWeightEntryDto } from './dto/create-weight-entry.dto';
import { WeightProgressStatsDto, WeightEntryDto } from './dto/weight-progress-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';

@Controller('user-progress')
@UseGuards(JwtAuthGuard)
export class UserProgressController {
  constructor(private readonly userProgressService: UserProgressService) {}

  @Get('weight')
  async getWeightProgress(
    @CurrentUser() user: User,
  ): Promise<WeightProgressStatsDto> {
    return this.userProgressService.getWeightProgress(user.id);
  }

  @Post('weight')
  @HttpCode(HttpStatus.CREATED)
  async createWeightEntry(
    @CurrentUser() user: User,
    @Body() createDto: CreateWeightEntryDto,
  ): Promise<WeightEntryDto> {
    return this.userProgressService.createWeightEntry(user.id, createDto);
  }

  @Patch('weight/:entryId')
  @HttpCode(HttpStatus.OK)
  async updateWeightEntry(
    @CurrentUser() user: User,
    @Param('entryId') entryId: string,
    @Body() updateDto: Partial<CreateWeightEntryDto>,
  ): Promise<WeightEntryDto> {
    return this.userProgressService.updateWeightEntry(entryId, user.id, updateDto);
  }

  @Delete('weight/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWeightEntry(
    @CurrentUser() user: User,
    @Param('entryId') entryId: string,
  ): Promise<void> {
    return this.userProgressService.deleteWeightEntry(entryId, user.id);
  }
}

