import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreatePayPalOrderDto {
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @IsUUID()
  @IsNotEmpty()
  billingCycleId: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsUUID()
  @IsOptional()
  subscriptionId?: string;
}

export class ValidatePayPalPaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;
}







