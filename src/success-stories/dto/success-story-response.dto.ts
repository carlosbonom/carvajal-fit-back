export class SuccessStoryDto {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class SuccessStoriesResponseDto {
  stories: SuccessStoryDto[];
}


