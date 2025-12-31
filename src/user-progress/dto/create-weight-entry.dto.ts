import { IsNumber, IsNotEmpty, IsOptional, IsString, Min, Max, IsIn } from 'class-validator';

export class CreateWeightEntryDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(20)
  @Max(500)
  weightKg: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  recordedAt?: Date;

  @IsString()
  @IsOptional()
  @IsIn(['kg', 'lb'])
  inputUnit?: string; // Unidad en la que se ingresó el peso (se convierte a kg internamente)
}

