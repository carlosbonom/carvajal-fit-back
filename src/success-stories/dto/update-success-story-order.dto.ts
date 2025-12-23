import { IsInt, Min } from 'class-validator';

export class UpdateSuccessStoryOrderDto {
    @IsInt()
    @Min(0)
    sortOrder: number;
}
