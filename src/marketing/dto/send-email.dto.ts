import { IsString, IsNotEmpty, IsArray, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class EmailRecipientDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  name?: string;

  [key: string]: any; // Para campos adicionales del Excel
}

export class SendEmailDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailRecipientDto)
  recipients: EmailRecipientDto[];

  @IsString()
  @IsOptional()
  subject?: string; // Opcional, si se quiere sobrescribir el subject de la plantilla
}







