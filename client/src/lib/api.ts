/// <reference types="vite/client" />
// 当本地开发时，VITE_API_URL 未设，默认利用 vite.config.ts 的 proxy (即 "");
// 线上构建时可通过设置 .env 的 VITE_API_URL 指向真实部署的 worker url 
const API_BASE = import.meta.env.VITE_API_URL || "";

type PublicCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const publicCache = new Map<string, PublicCacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

async function fetchJsonWithCache<T>(path: string, ttlMs: number): Promise<T> {
  const now = Date.now();
  const cached = publicCache.get(path) as PublicCacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inflight = inflightRequests.get(path) as Promise<T> | undefined;
  if (inflight) {
    return inflight;
  }

  const request = fetch(`${API_BASE}${path}`)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Request failed: ${path}`);
      }
      const value = await res.json() as T;
      publicCache.set(path, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflightRequests.delete(path);
    });

  inflightRequests.set(path, request);
  return request;
}

/* ── 类型 ──────────────────────────────────── */
export type PostMeta = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  coverColor: string | null;
  coverImage: string | null;
  createdAt: string;
  tags: string[];
  pinned: boolean;
  publishAt: string | null;
  seriesSlug: string | null;
  category: string;
};

export type Post = PostMeta & {
  content: string;
  published: boolean;
  listed: boolean;
  updatedAt: string;
  viewCount: number;
  seriesOrder: number;
};

/* ── 公开 API ──────────────────────────────── */
export async function fetchPosts(): Promise<PostMeta[]> {
  return fetchJsonWithCache<PostMeta[]>("/api/posts", 60_000);
}

export async function fetchPost(slug: string): Promise<Post> {
  return fetchJsonWithCache<Post>(`/api/posts/${slug}`, 60_000);
}

export async function fetchTags(): Promise<{ id: number; name: string }[]> {
  const res = await fetch(`${API_BASE}/api/tags`);
  if (!res.ok) throw new Error("获取标签失败");
  return res.json();
}

export type CategoryInfo = { name: string; count: number };

export async function fetchCategories(): Promise<CategoryInfo[]> {
  try {
    return await fetchJsonWithCache<CategoryInfo[]>("/api/categories", 60_000);
  } catch {
    return [];
  }
}

export type SeriesPost = { slug: string; title: string; seriesOrder: number };

export async function fetchSeriesPosts(seriesSlug: string): Promise<SeriesPost[]> {
  const res = await fetch(`${API_BASE}/api/series/${seriesSlug}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchReactions(slug: string): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE}/api/posts/${slug}/reactions`);
  if (!res.ok) return {};
  return res.json();
}

export async function toggleReaction(slug: string, type: string): Promise<{ action: string; reactions: Record<string, number> }> {
  const res = await fetch(`${API_BASE}/api/posts/${slug}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
  return res.json();
}

/* ── 独立页面导航 ────────────────────────────── */
export type NavPage = {
  slug: string;
  title: string;
  showInNav: boolean;
  sortOrder: number;
};

export async function fetchNavPages(): Promise<NavPage[]> {
  try {
    const all = await fetchJsonWithCache<NavPage[]>("/api/pages", 60_000);
    return all.filter((p) => p.showInNav);
  } catch {
    return [];
  }
}

/* ── 认证 ──────────────────────────────────── */
export function getToken(): string | null {
  return localStorage.getItem("monolith_token");
}

export function setToken(token: string) {
  localStorage.setItem("monolith_token", token);
}

export function clearToken() {
  localStorage.removeItem("monolith_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("密码错误");
  const data = await res.json();
  setToken(data.token);
  return data.token;
}

export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    return data.authenticated;
  } catch {
    return false;
  }
}

/* ── 管理 API ──────────────────────────────── */
export async function fetchAdminPosts(): Promise<Post[]> {
  const res = await fetch(`${API_BASE}/api/admin/posts`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("获取文章列表失败");
  return res.json();
}

export async function createPost(data: {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  coverColor?: string;
  published?: boolean;
  tags?: string[];
  pinned?: boolean;
  publishAt?: string | null;
}): Promise<Post> {
  const res = await fetch(`${API_BASE}/api/admin/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("创建文章失败");
  return res.json();
}

export async function updatePost(
  slug: string,
  data: Partial<Post & { tags: string[]; saveVersion?: boolean }>
): Promise<Post> {
  const res = await fetch(`${API_BASE}/api/admin/posts/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("更新文章失败");
  return res.json();
}

export async function deletePost(slug: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/posts/${slug}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("删除失败");
}

export async function batchOperatePosts(slugs: string[], action: "publish" | "unpublish" | "delete"): Promise<{ count: number }> {
  const res = await fetch(`${API_BASE}/api/admin/posts/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ slugs, action }),
  });
  if (!res.ok) throw new Error("批量操作失败");
  return res.json();
}

export type PostVersion = {
  id: number;
  postId: number;
  title: string;
  content: string;
  excerpt: string | null;
  createdAt: string;
};

export async function fetchPostVersions(slug: string): Promise<PostVersion[]> {
  const res = await fetch(`${API_BASE}/api/admin/posts/${slug}/versions`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("获取版本失败");
  return res.json();
}

export async function restorePostVersion(slug: string, versionId: number): Promise<{ success: boolean; post: Post }> {
  const res = await fetch(`${API_BASE}/api/admin/posts/${slug}/versions/${versionId}/restore`, { 
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "恢复版本失败");
  }
  return res.json();
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/admin/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error("上传失败");
  return res.json();
}

/* ── 阅读统计 ──────────────────────────────── */
export type ViewStats = {
  totalViews: number;
  topPosts: { slug: string; title: string; viewCount: number }[];
};

export async function fetchViewStats(): Promise<ViewStats> {
  const res = await fetch(`${API_BASE}/api/admin/stats`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("获取统计数据失败");
  return res.json();
}

export type AnalyticsData = {
  visitsByDay: { date: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topReferers: { referer: string; count: number }[];
  deviceBreakdown: { device: string; count: number }[];
  topPages: { path: string; count: number }[];
};

export async function fetchAnalytics(days = 7): Promise<AnalyticsData> {
  const res = await fetch(`${API_BASE}/api/admin/analytics?days=${days}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("获取分析数据失败");
  return res.json();
}

/* ── 评论 ──────────────────────────────────── */
export type CommentData = {
  id: number;
  postId: number;
  authorName: string;
  content: string;
  approved: boolean;
  createdAt: string;
};

export type AdminComment = CommentData & {
  authorEmail: string;
  postSlug: string;
  postTitle: string;
};

export async function fetchComments(slug: string): Promise<CommentData[]> {
  const res = await fetch(`${API_BASE}/api/posts/${slug}/comments`);
  if (!res.ok) throw new Error("获取评论失败");
  return res.json();
}

export async function submitComment(slug: string, data: {
  authorName: string;
  authorEmail?: string;
  content: string;
  _hp?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/api/posts/${slug}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchAdminComments(): Promise<AdminComment[]> {
  const res = await fetch(`${API_BASE}/api/admin/comments`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("获取评论失败");
  return res.json();
}

export async function approveComment(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/comments/${id}/approve`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("审核失败");
}

export async function deleteComment(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/comments/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("删除失败");
}

/* ── 媒体管理 ──────────────────────────────── */
export type MediaItem = {
  key: string;
  name: string;
  url: string;
  size: number;
  uploaded: string;
};

export async function fetchMedia(): Promise<MediaItem[]> {
  const res = await fetch(`${API_BASE}/api/admin/media`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("获取媒体列表失败");
  return res.json();
}

export async function deleteMedia(key: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/media/${key}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("删除失败");
}

/* ── 外链图片转本地 ────────────────────────── */
export type LocalizeResult = {
  replaced: number;
  failed: number;
  total: number;
  errors?: string[];
  message?: string;
};

export type LocalizeAllResult = {
  totalReplaced: number;
  totalFailed: number;
  posts: { slug: string; title: string; replaced: number; failed: number }[];
};

export async function localizePostImages(slug: string): Promise<LocalizeResult> {
  const res = await fetch(`${API_BASE}/api/admin/posts/${slug}/localize-images`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("外链转本地失败");
  return res.json();
}

export async function localizeAllImages(): Promise<LocalizeAllResult> {
  const res = await fetch(`${API_BASE}/api/admin/localize-all-images`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("批量外链转本地失败");
  return res.json();
}

/* ── Halo 迁移导入 ─────────────────────────── */
export type HaloPreview = {
  success: boolean;
  preview: { postCount: number; tagCount: number; categoryCount: number; commentCount: number };
  postTitles: { title: string; slug: string }[];
  tagNames: string[];
};

export async function previewHaloImport(data: any): Promise<HaloPreview> {
  const res = await fetch(`${API_BASE}/api/admin/import/halo/preview`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Halo 数据解析失败");
  return res.json();
}

export async function importHaloData(data: any, mode: "merge" | "overwrite" = "merge"): Promise<{ success: boolean; imported: any; mode: string }> {
  const res = await fetch(`${API_BASE}/api/admin/import/halo`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ data, mode }),
  });
  if (!res.ok) throw new Error("Halo 数据导入失败");
  return res.json();
}
