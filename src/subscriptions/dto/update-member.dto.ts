import { IsOptional, IsString, IsEmail, IsEnum, IsDateString, IsUUID, MinLength } from 'class-validator';
import { UserStatus } from '../../database/entities/users.entity';
import { SubscriptionStatus } from '../../database/entities/user-subscriptions.entity';

export class UpdateMemberDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @IsOptional()
    @IsEnum(SubscriptionStatus)
    subscriptionStatus?: SubscriptionStatus;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsUUID()
    planId?: string;

    @IsOptional()
    @IsUUID()
    billingCycleId?: string;

    @IsOptional()
    @IsDateString()
    startedAt?: string;

    @IsOptional()
    @IsDateString()
    currentPeriodStart?: string;

    @IsOptional()
    @IsDateString()
    currentPeriodEnd?: string;
}
