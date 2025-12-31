import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Min, MaxLength } from 'class-validator';

export class CreateSuccessStoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}







