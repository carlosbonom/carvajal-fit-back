import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateMercadoPagoCheckoutDto {
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

export class ValidateMercadoPagoPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;
}







