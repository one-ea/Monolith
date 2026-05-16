import { useEffect } from "react";

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

/**
 * SEO 头部组件
 * 动态注入 <title>、<meta>、Open Graph、Twitter Card、Canonical URL
 * 和 JSON-LD 结构化数据（文章页）
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
  siteName = DEFAULT_SITE_NAME,
  breadcrumbs,
  noindex = false,
}: SeoProps) {
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} — ${metaDescription}`;
  const canonicalUrl = url ? `${window.location.origin}${url}` : window.location.href;
  const ogImage = image || `${window.location.origin}/og-default.png`;

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

    // Open Graph
    setMeta("property", "og:title", title || siteName);
    setMeta("property", "og:description", metaDescription);
    setMeta("property", "og:type", type === "article" ? "article" : "website");
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:locale", "zh_CN");

    // Twitter Card
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title || siteName);
    setMeta("name", "twitter:description", metaDescription);
    setMeta("name", "twitter:image", ogImage);

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

    // JSON-LD 结构化数据
    let ldScript = document.querySelector('script[data-seo="json-ld"]') as HTMLScriptElement | null;
    const jsonLdArray: object[] = [];

    if (type === "article") {
      // 文章页：BlogPosting
      jsonLdArray.push({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        description: metaDescription,
        url: canonicalUrl,
        image: ogImage,
        datePublished: publishedTime,
        ...(modifiedTime ? { dateModified: modifiedTime } : {}),
        author: {
          "@type": "Person",
          name: siteName,
        },
        publisher: {
          "@type": "Organization",
          name: siteName,
        },
        ...(tags?.length ? { keywords: tags.join(", ") } : {}),
      });
    } else if (url === "/") {
      // 首页：WebSite + SearchAction
      jsonLdArray.push({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName,
        url: window.location.origin,
        description: metaDescription,
        potentialAction: {
          "@type": "SearchAction",
          target: `${window.location.origin}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      });
    }

    // 面包屑导航
    if (breadcrumbs?.length) {
      jsonLdArray.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${window.location.origin}${item.url}`,
        })),
      });
    }

    if (jsonLdArray.length > 0) {
      if (!ldScript) {
        ldScript = document.createElement("script");
        ldScript.setAttribute("type", "application/ld+json");
        ldScript.setAttribute("data-seo", "json-ld");
        document.head.appendChild(ldScript);
      }
      ldScript.textContent = jsonLdArray.length === 1
        ? JSON.stringify(jsonLdArray[0])
        : JSON.stringify(jsonLdArray);
    } else if (ldScript) {
      ldScript.remove();
    }

    // 组件卸载时清理动态注入的标签
    return () => {
      const script = document.querySelector('script[data-seo="json-ld"]');
      script?.remove();
      // 清理 article 相关 meta（防止页面切换残留）
      document.querySelectorAll('meta[property^="article:"]').forEach((el) => el.remove());
    };
  }, [fullTitle, metaDescription, canonicalUrl, ogImage, type, publishedTime, modifiedTime, title, siteName, tags, breadcrumbs, noindex]);

  return null; // 纯副作用组件，不渲染 DOM
}
