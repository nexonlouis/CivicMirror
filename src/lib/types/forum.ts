export interface ForumPost {
  id: string;
  title: string;
  body: string;
  issueSlugs: string[];
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  authorId: string;
  authorUsername: string;
  score: number;
  userVote: -1 | 1 | null;
  commentCount: number;
}

export interface ForumComment {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorUsername: string;
}
