import { IsString, IsNotEmpty, MinLength } from 'class-validator';

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
}


