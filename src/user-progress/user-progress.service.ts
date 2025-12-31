import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UserWeightProgress } from '../database/entities/user-weight-progress.entity';
import { User } from '../database/entities/users.entity';
import { CreateWeightEntryDto } from './dto/create-weight-entry.dto';
import { WeightProgressStatsDto, WeightEntryDto } from './dto/weight-progress-response.dto';

@Injectable()
export class UserProgressService {
  constructor(
    @InjectRepository(UserWeightProgress)
    private readonly weightProgressRepository: Repository<UserWeightProgress>,
  ) {}

  async createWeightEntry(
    userId: string,
    createDto: CreateWeightEntryDto,
  ): Promise<WeightEntryDto> {
    // Convertir a kg si viene en libras
    let weightInKg = createDto.weightKg;
    if (createDto.inputUnit === 'lb') {
      weightInKg = createDto.weightKg / 2.20462; // Convertir libras a kg
    }

    const entry = this.weightProgressRepository.create({
      user: { id: userId } as User,
      weightKg: weightInKg,
      notes: createDto.notes || null,
      recordedAt: createDto.recordedAt || new Date(),
    });

    const saved = await this.weightProgressRepository.save(entry);

    return {
      id: saved.id,
      weightKg: saved.weightKg,
      notes: saved.notes,
      recordedAt: saved.recordedAt,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async getWeightProgress(userId: string): Promise<WeightProgressStatsDto> {
    const entries = await this.weightProgressRepository.find({
      where: { user: { id: userId } },
      order: { recordedAt: 'ASC' },
    });

    if (entries.length === 0) {
      return {
        currentWeight: null,
        startingWeight: null,
        totalLoss: null,
        totalGain: null,
        entries: [],
      };
    }

    const sortedEntries = entries.sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
    );

    const startingWeight = sortedEntries[0].weightKg;
    const currentWeight = sortedEntries[sortedEntries.length - 1].weightKg;
    const difference = currentWeight - startingWeight;

    const entriesDto: WeightEntryDto[] = entries.map((entry) => ({
      id: entry.id,
      weightKg: entry.weightKg,
      notes: entry.notes,
      recordedAt: entry.recordedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));

    return {
      currentWeight,
      startingWeight,
      totalLoss: difference < 0 ? Math.abs(difference) : null,
      totalGain: difference > 0 ? difference : null,
      entries: entriesDto,
    };
  }

  async deleteWeightEntry(entryId: string, userId: string): Promise<void> {
    const entry = await this.weightProgressRepository.findOne({
      where: { id: entryId, user: { id: userId } },
    });

    if (!entry) {
      throw new NotFoundException('Entrada de peso no encontrada');
    }

    await this.weightProgressRepository.remove(entry);
  }

  async updateWeightEntry(
    entryId: string,
    userId: string,
    updateDto: Partial<CreateWeightEntryDto>,
  ): Promise<WeightEntryDto> {
    const entry = await this.weightProgressRepository.findOne({
      where: { id: entryId, user: { id: userId } },
    });

    if (!entry) {
      throw new NotFoundException('Entrada de peso no encontrada');
    }

    if (updateDto.weightKg !== undefined) {
      // Convertir a kg si viene en libras
      let weightInKg = updateDto.weightKg;
      if ((updateDto as any).inputUnit === 'lb') {
        weightInKg = updateDto.weightKg / 2.20462; // Convertir libras a kg
      }
      entry.weightKg = weightInKg;
    }
    if (updateDto.notes !== undefined) {
      entry.notes = updateDto.notes || null;
    }
    if (updateDto.recordedAt !== undefined) {
      entry.recordedAt = updateDto.recordedAt;
    }

    const updated = await this.weightProgressRepository.save(entry);

    return {
      id: updated.id,
      weightKg: updated.weightKg,
      notes: updated.notes,
      recordedAt: updated.recordedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}

