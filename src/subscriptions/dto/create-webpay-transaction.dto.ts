import { IsUUID, IsNotEmpty, IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateWebpayTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @IsUUID()
  @IsNotEmpty()
  billingCycleId: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class ValidateWebpayPaymentDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}







