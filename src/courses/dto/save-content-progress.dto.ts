import { IsInt, Min, Max } from 'class-validator';

export class SaveContentProgressDto {
  @IsInt({ message: 'El progreso debe ser un número entero' })
  @Min(0, { message: 'El progreso no puede ser negativo' })
  progressSeconds: number;

  @IsInt({ message: 'La duración total debe ser un número entero' })
  @Min(0, { message: 'La duración total no puede ser negativa' })
  totalSeconds: number;
}






