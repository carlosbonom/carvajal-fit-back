import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @IsUUID()
  @IsNotEmpty()
  billingCycleId: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  payerEmail?: string;

  @IsString()
  @IsOptional()
  payerFirstName?: string;

  @IsString()
  @IsOptional()
  payerLastName?: string;

  @IsString()
  @IsOptional()
  payerIdentificationType?: string;

  @IsString()
  @IsOptional()
  payerIdentificationNumber?: string;

  @IsString()
  @IsOptional()
  backUrl?: string;
}

