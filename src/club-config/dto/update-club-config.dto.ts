import {
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class UpdateClubConfigDto {
  @IsOptional()
  @IsString()
  whatsappLink?: string;

  @IsOptional()
  @IsDateString()
  nextMeetingDateTime?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string;
}

