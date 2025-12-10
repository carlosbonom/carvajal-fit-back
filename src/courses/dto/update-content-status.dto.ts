import { IsBoolean } from 'class-validator';

export class UpdateContentStatusDto {
  @IsBoolean({ message: 'El estado debe ser un valor booleano' })
  isActive: boolean;
}

