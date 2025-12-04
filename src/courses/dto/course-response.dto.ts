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
  };
  createdAt: Date;
  updatedAt: Date;
}

export class ContentResponseDto {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  contentType: string;
  unlockMonth: number;
  contentUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  sortOrder: number;
  hasResources: boolean;
  resourcesUrl: string | null;
  isPreview: boolean;
  course: {
    id: string;
    title: string;
    slug: string;
  };
  createdAt: Date;
  updatedAt: Date;
}


