import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;
}

