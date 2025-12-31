import { IsBoolean } from 'class-validator';

export class MarkContentCompletedDto {
  @IsBoolean({ message: 'El estado de completado debe ser un booleano' })
  isCompleted: boolean;
}






