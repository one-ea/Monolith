/* 统一内容模型：SPA / 爬虫预渲染 / llms 输出 / SEO-GEO 审计共用一份 PageDocument。
   见 tmp/Monolith-SEO-GEO-Evaluation-Report.md §8。 */

import type { HeadingRef, ImageRef, LinkRef } from "./markdown";
import type { ImageSize } from "./image-size";

export type PageType = "website" | "article" | "page" | "collection";

/** 站点级上下文（控制台 settings + 部署变量归一后的结果） */
export interface SiteContext {
  /** 对外公开 origin，无尾斜杠，如 https://example.com */
  origin: string;
  title: string;
  description: string;
  author: {
    name: string;
    url?: string;
    avatar?: string;
  };
  /** 默认分享图（settings.site_og_image 原始值，可为相对路径或空） */
  ogImageDefault?: string;
  /** BCP 47 语言标签，如 zh-CN */
  locale: string;
}

export interface BreadcrumbRef {
  name: string;
  /** 站内路径（/ 开头）或绝对地址 */
  url: string;
}

export interface PageDocument {
  /** 绝对地址 */
  url: string;
  title: string;
  /** 页面自身描述；为 null 时消费方回退 site.description */
  description: string | null;
  /** 默认等于 url */
  canonical: string;
  type: PageType;

  site: SiteContext;

  headings: HeadingRef[];
  links: LinkRef[];
  images: ImageRef[];

  /** Markdown 去标记后的纯文本（不含代码块） */
  contentText: string;
  contentMarkdown?: string;

  coverImage?: string | null;
  /** og:image 真实尺寸（可选；由消费方探测文件头得到，渲染 og:image:width/height） */
  ogImageSize?: ImageSize;

  publishedAt: string | null;
  modifiedAt: string | null;

  tags?: string[];
  breadcrumbs?: BreadcrumbRef[];
  noindex?: boolean;
}
