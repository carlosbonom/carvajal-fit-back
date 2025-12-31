import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyPayPalCaptureDto {
  @IsString()
  @IsNotEmpty()
  captureId: string;
}







