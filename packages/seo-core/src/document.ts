/* PageDocument 构建：D1 文章/页面数据 + 站点上下文 → 统一内容模型 */

import {
  extractHeadings,
  extractImages,
  extractLinks,
  stripMarkdown,
} from "./markdown";
import type { ImageSize } from "./image-size";
import type { PageDocument, PageType, SiteContext, BreadcrumbRef } from "./types";

/** 归一为绝对 http(s) 地址；非法输入返回 "" */
export function toAbsoluteUrl(value: string, origin: string): string {
  if (!value) return "";
  try {
    const resolved = new URL(value, origin);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.toString() : "";
  } catch {
    return "";
  }
}

export interface PageDocumentInput {
  /** 站内路径（/ 开头） */
  path: string;
  title: string;
  description?: string | null;
  type?: PageType;
  contentMarkdown?: string;
  coverImage?: string | null;
  ogImageSize?: ImageSize;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  tags?: string[];
  breadcrumbs?: BreadcrumbRef[];
  noindex?: boolean;
  site: SiteContext;
}

export function buildPageDocument(input: PageDocumentInput): PageDocument {
  const origin = input.site.origin.replace(/\/+$/, "");
  const site: SiteContext = { ...input.site, origin };
  const md = input.contentMarkdown ?? "";
  const url = toAbsoluteUrl(input.path, origin) || `${origin}/`;

  return {
    url,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    canonical: url,
    type: input.type ?? "page",
    site,
    headings: extractHeadings(md),
    links: extractLinks(md),
    images: extractImages(md),
    contentText: stripMarkdown(md),
    contentMarkdown: md || undefined,
    coverImage: input.coverImage || null,
    ogImageSize: input.ogImageSize,
    publishedAt: input.publishedAt ?? null,
    modifiedAt: input.modifiedAt ?? null,
    tags: input.tags,
    breadcrumbs: input.breadcrumbs,
    noindex: input.noindex,
  };
}
