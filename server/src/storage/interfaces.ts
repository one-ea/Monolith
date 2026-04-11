/* ──────────────────────────────────────────────
   Monolith 存储抽象接口
   所有数据库 / 对象存储操作通过此接口调用
   路由层不应该知道底层是 D1 还是 Turso 还是 PG
   ────────────────────────────────────────────── */

/* ── 业务数据类型 ─────────────────────────── */

export type Post = {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  coverColor: string;
  published: boolean;
  listed: boolean;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  pinned: boolean;
  publishAt: string | null;
};

export type PostSummary = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  coverColor: string;
  createdAt: string;
  tags: string[];
  pinned: boolean;
  publishAt: string | null;
};

export type Tag = {
  id: number;
  name: string;
};

export type Page = {
  id: number;
  slug: string;
  title: string;
  content: string;
  sortOrder: number;
  published: boolean;
  showInNav: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PageSummary = {
  slug: string;
  title: string;
  showInNav: boolean;
  sortOrder: number;
};

export type CreatePostInput = {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  coverColor?: string;
  published?: boolean;
  listed?: boolean;
  tags?: string[];
  pinned?: boolean;
  publishAt?: string | null;
};

export type UpdatePostInput = {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  coverColor?: string;
  published?: boolean;
  listed?: boolean;
  tags?: string[];
  pinned?: boolean;
  publishAt?: string | null;
};

export type UpsertPageInput = {
  slug: string;
  title: string;
  content: string;
  sortOrder?: number;
  published?: boolean;
  showInNav?: boolean;
};

export type BackupData = {
  version: string;
  exportedAt: string;
  posts: Post[];
  tags: Tag[];
  postTags: { postId: number; tagId: number }[];
  settings: Record<string, string>;
  meta: {
    postCount: number;
    tagCount: number;
  };
};

export type ImportResult = {
  posts: number;
  tags: number;
  settings: number;
};

export type ViewStats = {
  totalViews: number;
  topPosts: { slug: string; title: string; viewCount: number }[];
};

export type Comment = {
  id: number;
  postId: number;
  authorName: string;
  authorEmail: string;
  content: string;
  approved: boolean;
  createdAt: string;
};

export type CreateCommentInput = {
  postSlug: string;
  authorName: string;
  authorEmail?: string;
  content: string;
};

/* ── 数据库抽象接口 ───────────────────────── */

export interface IDatabase {
  /* 文章 */
  getPublishedPosts(): Promise<PostSummary[]>;
  getAllPosts(): Promise<(Post & { tags: string[] })[]>;
  getPostBySlug(slug: string): Promise<(Post & { tags: string[] }) | null>;
  createPost(data: CreatePostInput): Promise<Post>;
  updatePost(slug: string, data: UpdatePostInput): Promise<Post | null>;
  deletePost(slug: string): Promise<boolean>;

  /* 标签 */
  getAllTags(): Promise<Tag[]>;

  /* 独立页 */
  getPublishedPages(): Promise<PageSummary[]>;
  getAllPages(): Promise<Page[]>;
  getPageBySlug(slug: string): Promise<Page | null>;
  getPublishedPageBySlug(slug: string): Promise<Page | null>;
  upsertPage(data: UpsertPageInput): Promise<{ action: "created" | "updated" }>;
  deletePage(slug: string): Promise<boolean>;

  /* 设置 */
  getSettings(): Promise<Record<string, string>>;
  getSetting(key: string): Promise<string | null>;
  saveSettings(settings: Record<string, string>): Promise<void>;

  /* 流量统计 */
  recordDailyView(): Promise<void>;
  getDailyViews(days: number): Promise<{ date: string; count: number }[]>;
  getTotalViews(): Promise<number>;

  /* 备份与恢复 */
  exportAll(): Promise<BackupData>;
  importAll(data: {
    posts?: CreatePostInput[];
    tags?: { name: string }[];
    settings?: Record<string, string>;
    mode?: "merge" | "overwrite";
  }): Promise<ImportResult>;

  /* 搜索 */
  searchPosts(query: string, limit?: number): Promise<PostSummary[]>;

  /* 阅读统计 */
  incrementViewCount(slug: string): Promise<void>;
  getViewStats(topN?: number): Promise<ViewStats>;

  /* RSS 专用快捷方法 */
  getRecentPublishedPosts(limit: number): Promise<Pick<Post, "slug" | "title" | "excerpt" | "content" | "createdAt">[]>;

  /* 评论 */
  getApprovedComments(postSlug: string): Promise<Comment[]>;
  addComment(input: CreateCommentInput): Promise<Comment>;
  getAllComments(): Promise<(Comment & { postSlug: string; postTitle: string })[]>;
  approveComment(id: number): Promise<boolean>;
  deleteComment(id: number): Promise<boolean>;
  getCommentCount(postSlug: string): Promise<number>;
}

/* ── 对象存储抽象接口 ─────────────────────── */

export type StorageObject = {
  body: ReadableStream;
  contentType: string;
  /** 写入 HTTP 响应头（R2 原生方法的抽象） */
  writeHeaders(headers: Headers): void;
};

export type StorageListItem = {
  key: string;
  size: number;
  uploaded: string;
};

export interface IObjectStorage {
  /** 上传文件 */
  put(key: string, data: ReadableStream | ArrayBuffer | string, options?: {
    contentType?: string;
    customMetadata?: Record<string, string>;
  }): Promise<void>;

  /** 获取文件 */
  get(key: string): Promise<StorageObject | null>;

  /** 删除文件 */
  delete(key: string): Promise<void>;

  /** 列出文件 */
  list(prefix: string, limit?: number): Promise<StorageListItem[]>;
}
