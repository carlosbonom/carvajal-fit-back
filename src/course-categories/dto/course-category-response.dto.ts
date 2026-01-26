export class CourseCategoryResponseDto {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  coverUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  parent?: CourseCategoryResponseDto;
  subcategories?: CourseCategoryResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

