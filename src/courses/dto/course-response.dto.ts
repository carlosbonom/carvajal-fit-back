import { CourseLevel } from '../../database/entities/courses.entity';

export class CourseResponseDto {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  trailerUrl: string | null;
  level: CourseLevel | null;
  durationMinutes: number | null;
  isPublished: boolean;
  publishedAt: Date | null;
  sortOrder: number;
  metadata: Record<string, any> | null;
  creator: {
    id: string;
    name: string;
    slug: string;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ContentResourceResponseDto {
  id: string;
  title: string;
  description: string | null;
  resourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ContentResponseDto {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  contentType: string;
  unlockValue: number;
  unlockType: string;
  contentUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  sortOrder: number;
  availabilityType: string;
  resources: ContentResourceResponseDto[];
  isPreview: boolean;
  isActive: boolean;
  course: {
    id: string;
    title: string;
    slug: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class CourseWithContentResponseDto extends CourseResponseDto {
  content: ContentResponseDto[];
}



