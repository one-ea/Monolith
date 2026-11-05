import { useEffect } from "react";
import {
  buildJsonLdGraph,
  buildPageDocument,
  renderTitle,
  resolveOgImage,
  type SiteContext,
} from "@monolith/seo-core";
import { useSiteSettings } from "@/lib/site-settings";

type BreadcrumbItem = {
  name: string;
  url: string;
};

type SeoProps = {
  title?: string;
  description?: string;
  url?: string;
  type?: "website" | "article";
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  siteName?: string;
  breadcrumbs?: BreadcrumbItem[];
  noindex?: boolean;
};

const DEFAULT_SITE_NAME = "Monolith";
const DEFAULT_DESCRIPTION = "书写代码、设计与边缘计算的个人博客。";
const SITE_LOCALE = "zh-CN";

/**
 * SEO 头部组件（DOM 注入壳）
 * head 数据全部由 @monolith/seo-core 生成 —— 与爬虫预渲染中间件同一数据源、同一生成器，
 * 本组件只负责把生成结果同步进 document.head（Phase 1c 统一改造）。
 *
 * 使用方式：
 *   <SeoHead title="文章标题" description="..." url="/posts/slug" type="article" />
 */
export function SeoHead({
  title,
  description,
  url,
  type = "website",
  image,
  publishedTime,
  modifiedTime,
  tags,
  siteName: siteNameOverride,
  breadcrumbs,
  noindex = false,
}: SeoProps) {
  const { settings } = useSiteSettings();

  // 站点名 / 描述 / 作者 / 默认分享图取自控制台设置，缺失时回退内置默认值
  const siteName = siteNameOverride || settings.site_title.trim() || DEFAULT_SITE_NAME;
  const siteDescription = settings.site_description.trim() || DEFAULT_DESCRIPTION;
  const authorName = settings.author_name.trim() || siteName;
  const authorAvatar = settings.author_avatar.trim();
  const siteOgImage = settings.site_og_image.trim();

  const site: SiteContext = {
    origin: window.location.origin,
    title: siteName,
    description: siteDescription,
    author: {
      name: authorName,
      ...(authorAvatar ? { avatar: authorAvatar } : {}),
    },
    ...(siteOgImage ? { ogImageDefault: siteOgImage } : {}),
    locale: SITE_LOCALE,
  };

  const doc = buildPageDocument({
    path: url || window.location.pathname,
    title: title ?? "",
    type,
    description: description || null,
    coverImage: image || null,
    publishedAt: publishedTime ?? null,
    modifiedAt: modifiedTime ?? null,
    tags,
    breadcrumbs,
    noindex,
    site,
  });

  const fullTitle = renderTitle(doc);
  const metaDescription = doc.description || siteDescription;
  const canonicalUrl = doc.canonical;
  const ogImage = resolveOgImage(doc);
  const imageAlt = doc.title ? `${doc.title} | ${siteName}` : siteName;
  // 序列化结果作为原始值依赖，避免 doc 对象身份导致 effect 每次渲染重跑
  const jsonLdText = JSON.stringify(buildJsonLdGraph(doc));

  useEffect(() => {
    // 设置标题
    document.title = fullTitle;

    // 辅助：设置或更新 meta 标签
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // 辅助：设置或更新 link 标签
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    // Meta Description
    setMeta("name", "description", metaDescription);

    // Robots（404 等页面需要 noindex）
    if (noindex) {
      setMeta("name", "robots", "noindex, nofollow");
    } else {
      // 移除可能残留的 noindex
      const robotsMeta = document.querySelector('meta[name="robots"]');
      if (robotsMeta?.getAttribute("content")?.includes("noindex")) {
        robotsMeta.remove();
      }
    }

    // Canonical URL
    setLink("canonical", canonicalUrl);

    // Open Graph（键集合与 renderSeoHead 保持一致；不声明静态 og:image:width/height ——
    // 对任意封面是错误数据，等有真实尺寸来源再补）
    setMeta("property", "og:title", title || siteName);
    setMeta("property", "og:description", metaDescription);
    setMeta("property", "og:type", type === "article" ? "article" : "website");
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:image:alt", imageAlt);
    setMeta("property", "og:locale", SITE_LOCALE.replace("-", "_"));

    // Twitter Card
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title || siteName);
    setMeta("name", "twitter:description", metaDescription);
    setMeta("name", "twitter:image", ogImage);
    setMeta("name", "twitter:image:alt", imageAlt);

    // Article 专属
    // 先清理旧的 article 相关 meta（防止页面切换残留）
    document.querySelectorAll('meta[property^="article:"]').forEach((el) => el.remove());

    if (type === "article" && publishedTime) {
      setMeta("property", "article:published_time", publishedTime);
    }
    if (type === "article" && modifiedTime) {
      setMeta("property", "article:modified_time", modifiedTime);
    }
    if (type === "article" && tags?.length) {
      // 每个标签需要独立的 <meta> 元素（不能复用同一个）
      tags.forEach((tag) => {
        const el = document.createElement("meta");
        el.setAttribute("property", "article:tag");
        el.setAttribute("content", tag);
        document.head.appendChild(el);
      });
    }

    // JSON-LD：统一 @graph（buildJsonLdGraph 与爬虫预渲染同源；
    // 基础实体 WebSite/Person/Organization 始终存在，article 页追加 WebPage/BlogPosting）
    let ldScript = document.querySelector('script[data-seo="json-ld"]') as HTMLScriptElement | null;
    if (!ldScript) {
      ldScript = document.createElement("script");
      ldScript.setAttribute("type", "application/ld+json");
      ldScript.setAttribute("data-seo", "json-ld");
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = jsonLdText;

    // 组件卸载时清理动态注入的标签
    return () => {
      const script = document.querySelector('script[data-seo="json-ld"]');
      script?.remove();
      // 清理 article 相关 meta（防止页面切换残留）
      document.querySelectorAll('meta[property^="article:"]').forEach((el) => el.remove());
    };
  }, [fullTitle, metaDescription, canonicalUrl, ogImage, imageAlt, type, publishedTime, modifiedTime, title, siteName, tags, breadcrumbs, noindex, jsonLdText]);

  return null; // 纯副作用组件，不渲染 DOM
}
