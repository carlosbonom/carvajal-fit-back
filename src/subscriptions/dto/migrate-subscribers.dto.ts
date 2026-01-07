
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, IsDateString, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum MigrationStatus {
    ACTIVE = 'active',
    CANCELLED = 'cancelled',
    PAUSED = 'paused'
}

export class MigratedSubscriberDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsOptional()
    name?: string;

    @IsEnum(MigrationStatus)
    @IsNotEmpty()
    status: MigrationStatus;

    @IsDateString()
    @IsNotEmpty()
    startDate: string;

    @IsDateString()
    @IsOptional()
    lastActivationDate?: string;

    @IsString()
    @IsOptional()
    planName?: string; // Nombre del plan para buscarlo o crearlo si es necesario
}

export class MigrateSubscribersDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MigratedSubscriberDto)
    subscribers: MigratedSubscriberDto[];
}
