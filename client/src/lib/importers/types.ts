/**
 * 多平台博客数据导入系统 — 公共类型定义
 * 所有平台转换器（Importer）共享统一的导入数据结构。
 */

/** 转换后的标准化文章结构，与 Monolith 的 importAll 接口兼容 */
export interface ImportedPost {
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  coverImage?: string;
  published: boolean;
  pinned: boolean;
  listed: boolean;
  publishAt?: string | null;
  category?: string;
  tags: string[];
}

/** 导入预览摘要，用于在确认导入前向用户展示 */
export interface ImportPreview {
  platform: string;
  postCount: number;
  tagCount: number;
  categoryCount: number;
  commentCount: number;
  postTitles: { title: string; slug: string }[];
  tagNames: string[];
  warnings: string[];
}

/** 转换器统一返回的解析结果 */
export interface ImportResult {
  posts: ImportedPost[];
  tags: { name: string }[];
  preview: ImportPreview;
}

/** 平台导入器的注册信息 */
export interface PlatformInfo {
  id: string;
  name: string;
  description: string;
  /** file input 的 accept 属性 */
  accept: string;
  /** 是否支持多文件上传（Markdown 类平台需要） */
  multiple: boolean;
  /** 颜色标识（用于 UI 卡片） */
  color: string;
  /** 解析入口 */
  parse: (files: File[]) => Promise<ImportResult>;
}
