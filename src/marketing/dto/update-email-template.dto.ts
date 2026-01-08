import { IsString, IsOptional, MinLength, IsObject } from 'class-validator';

export class UpdateEmailTemplateDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  name?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  subject?: string;

  @IsString()
  @IsOptional()
  htmlContent?: string;

  @IsObject()
  @IsOptional()
  design?: any;

  @IsOptional()
  isLocked?: boolean;
}







