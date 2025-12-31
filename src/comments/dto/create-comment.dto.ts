import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;
}

