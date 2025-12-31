export class UserInfoDto {
  id: string;
  name: string | null;
  email: string;
}

export class CommentResponseDto {
  id: string;
  text: string;
  user: UserInfoDto;
  parentId: string | null;
  replies: CommentResponseDto[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

