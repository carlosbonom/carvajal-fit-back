import { IsString, IsNotEmpty, MinLength, IsObject, IsOptional } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  subject: string;

  @IsString()
  @IsNotEmpty()
  htmlContent: string;

  @IsObject()
  @IsOptional()
  design?: any;

  @IsOptional()
  isLocked?: boolean;
}







