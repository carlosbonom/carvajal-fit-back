import { IsOptional, IsString, IsEnum } from 'class-validator';
import { SubscriptionStatus } from '../../database/entities/user-subscriptions.entity';

export class GetMembersQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // Buscar por nombre o email

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus; // Filtrar por estado de suscripción
}

