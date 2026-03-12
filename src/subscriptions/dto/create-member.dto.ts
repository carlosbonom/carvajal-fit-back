import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsDateString, IsBoolean } from 'class-validator';
import { UserStatus } from '../../database/entities/users.entity';
import { SubscriptionStatus } from '../../database/entities/user-subscriptions.entity';

export class CreateMemberDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsEnum(UserStatus)
    @IsOptional()
    status?: UserStatus;

    @IsEnum(SubscriptionStatus)
    @IsOptional()
    subscriptionStatus?: SubscriptionStatus;

    @IsUUID()
    @IsOptional()
    planId?: string;

    @IsUUID()
    @IsOptional()
    billingCycleId?: string;

    @IsDateString()
    @IsOptional()
    startedAt?: string;

    @IsDateString()
    @IsOptional()
    currentPeriodEnd?: string;

    @IsBoolean()
    @IsOptional()
    autoRenew?: boolean;

    @IsString()
    @IsOptional()
    currency?: string;
}
