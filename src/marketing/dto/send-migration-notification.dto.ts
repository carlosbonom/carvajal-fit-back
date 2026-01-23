import { IsArray, IsEmail, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MigrationRecipientDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    name: string;
}

export class SendMigrationNotificationDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MigrationRecipientDto)
    recipients: MigrationRecipientDto[];
}
