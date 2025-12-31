import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/users.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    Object.assign(user, updateData);
    return this.userRepository.save(user);
  }

  async updateRefreshToken(
    id: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.userRepository.update(id, { 
      refreshTokenHash: refreshTokenHash || undefined 
    });
  }

  async updateProfile(userId: string, updateDto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (updateDto.name !== undefined) {
      user.name = updateDto.name;
    }
    if (updateDto.phone !== undefined) {
      user.phone = updateDto.phone;
    }
    if (updateDto.countryCode !== undefined) {
      user.countryCode = updateDto.countryCode;
    }
    if (updateDto.preferredWeightUnit !== undefined) {
      user.preferredWeightUnit = updateDto.preferredWeightUnit;
    }

    return this.userRepository.save(user);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    // Hashear y actualizar nueva contraseña
    const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, this.SALT_ROUNDS);
    user.passwordHash = newPasswordHash;
    await this.userRepository.save(user);
  }
}

