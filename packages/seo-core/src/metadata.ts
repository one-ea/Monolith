/* HTML head 片段渲染 —— 爬虫预渲染（Pages Function）与 SPA SeoHead 共用同一生成器。
   输出为字符串片段；SPA 侧由注入壳消费，预渲染侧直接拼到 </head> 前。 */

import { toAbsoluteUrl } from "./document";
import type { PageDocument } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** og:image 兜底链：文章封面 → 站点默认分享图 → /og-default.png */
export function resolveOgImage(doc: PageDocument): string {
  const origin = doc.site.origin;
  return toAbsoluteUrl(doc.coverImage || "", origin)
    || toAbsoluteUrl(doc.site.ogImageDefault || "", origin)
    || `${origin}/og-default.png`;
}

/** 页面完整 title：文章页「标题 | 站名」，无标题页面「站名 — 描述」 */
export function renderTitle(doc: PageDocument): string {
  const description = doc.description || doc.site.description;
  return doc.title
    ? `${doc.title} | ${doc.site.title}`
    : `${doc.site.title} — ${description}`;
}

/** head 内 meta/canonical/title 片段（不含 JSON-LD；JSON-LD 见 schema.ts） */
export function renderSeoHead(doc: PageDocument): string {
  const { site } = doc;
  const description = doc.description || site.description;
  const ogImage = resolveOgImage(doc);
  const imageAlt = doc.title ? `${doc.title} | ${site.title}` : site.title;
  const title = doc.title || site.title;

  const lines: string[] = [
    `<title>${esc(renderTitle(doc))}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(doc.canonical)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:type" content="${doc.type === "article" ? "article" : "website"}" />`,
    `<meta property="og:url" content="${esc(doc.canonical)}" />`,
    `<meta property="og:site_name" content="${esc(site.title)}" />`,
    `<meta property="og:image" content="${esc(ogImage)}" />`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}" />`,
    `<meta property="og:locale" content="${esc(site.locale)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(ogImage)}" />`,
    `<meta name="twitter:image:alt" content="${esc(imageAlt)}" />`,
  ];

  if (doc.noindex) {
    lines.push(`<meta name="robots" content="noindex, nofollow" />`);
  }

  if (doc.type === "article") {
    if (doc.publishedAt) lines.push(`<meta property="article:published_time" content="${esc(doc.publishedAt)}" />`);
    if (doc.modifiedAt) lines.push(`<meta property="article:modified_time" content="${esc(doc.modifiedAt)}" />`);
    for (const tag of doc.tags || []) {
      lines.push(`<meta property="article:tag" content="${esc(tag)}" />`);
    }
  }

  return lines.join("\n");
}
