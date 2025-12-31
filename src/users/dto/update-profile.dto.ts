import { IsString, IsOptional, IsEmail, MaxLength, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  countryCode?: string;

  @IsString()
  @IsOptional()
  @IsIn(['kg', 'lb'])
  preferredWeightUnit?: string;
}

