import { IsInt, Min } from 'class-validator';

export class UpdateCourseOrderDto {
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0, { message: 'El orden debe ser mayor o igual a 0' })
  sortOrder: number;
}





