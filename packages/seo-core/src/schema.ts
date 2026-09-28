/* 统一 JSON-LD @graph 生成：WebSite / Person / Organization / WebPage / BlogPosting / BreadcrumbList
   全部实体用 @id 互相引用，单一数据源，杜绝 client 与 prerender 各拼一套。
   WebSite 声明 SearchAction —— 站内搜索浮层已支持 /?q= 深链（client/src/components/search.tsx）。 */

import type { PageDocument } from "./types";

type JsonLdNode = Record<string, unknown>;

export function buildJsonLdGraph(doc: PageDocument): { "@context": string; "@graph": JsonLdNode[] } {
  const origin = doc.site.origin.replace(/\/+$/, "");
  const websiteId = `${origin}/#website`;
  const authorId = `${origin}/#author`;
  const orgId = `${origin}/#organization`;
  const description = doc.description || doc.site.description;

  const graph: JsonLdNode[] = [
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: `${origin}/`,
      name: doc.site.title,
      description: doc.site.description,
      // inLanguage 用 BCP 47（zh-CN）；SiteContext.locale 可能是 og 的 ll_CC 格式，归一
      inLanguage: doc.site.locale.replace("_", "-"),
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${origin}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Person",
      "@id": authorId,
      name: doc.site.author.name,
      ...(doc.site.author.url ? { url: doc.site.author.url } : {}),
      ...(doc.site.author.avatar ? { image: doc.site.author.avatar } : {}),
    },
    {
      "@type": "Organization",
      "@id": orgId,
      name: doc.site.title,
      url: `${origin}/`,
    },
  ];

  if (doc.type === "article") {
    const webpageId = `${doc.canonical}#webpage`;
    graph.push({
      "@type": "WebPage",
      "@id": webpageId,
      url: doc.canonical,
      name: doc.title,
      description,
      isPartOf: { "@id": websiteId },
    });
    graph.push({
      "@type": "BlogPosting",
      "@id": `${doc.canonical}#article`,
      headline: doc.title,
      description,
      url: doc.canonical,
      ...(doc.coverImage ? { image: doc.coverImage } : {}),
      ...(doc.publishedAt ? { datePublished: doc.publishedAt } : {}),
      ...(doc.modifiedAt ? { dateModified: doc.modifiedAt } : {}),
      author: { "@id": authorId },
      publisher: { "@id": orgId },
      isPartOf: { "@id": webpageId },
      inLanguage: doc.site.locale.replace("_", "-"),
      ...(doc.tags?.length ? { keywords: doc.tags.join(", ") } : {}),
    });
  }

  if (doc.breadcrumbs?.length) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${doc.canonical}#breadcrumb`,
      itemListElement: doc.breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: new URL(item.url, origin).toString(),
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/** 渲染为可插入 head 的 <script> 标签；< 转义防止 </script> 提前闭合 */
export function renderJsonLdScript(doc: PageDocument): string {
  const json = JSON.stringify(buildJsonLdGraph(doc)).replace(/</g, "\\u003c");
  return `<script type="application/ld+json" data-seo="json-ld">${json}</script>`;
}
