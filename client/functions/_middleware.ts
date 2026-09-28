import { buildPageDocument, renderJsonLdScript, renderSeoHead, stripMarkdown, type SiteContext } from "@monolith/seo-core";
import { getBackendUrl } from "./_shared";

// Cloudflare Pages Function — 爬虫预渲染中间件
// 拦截社交平台/搜索引擎爬虫，返回带完整 SEO head 的文章 HTML；
// head 内容由 @monolith/seo-core 统一生成（与 SPA 的 SeoHead 同一数据源）
// 普通用户请求不受影响，直接返回 SPA

const BOT_UA_REGEX =
  /bot|crawl|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Embedly|Quora Link Preview|Showyoubot|outbrain|pinterest|vkShare|W3C_Validator|baiduspider|yandex|sogou|360Spider/i;

interface Env {
  API_BASE: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

// 拉取的公开设置中，构建 head 所需的字段
interface PublicSeoSettings {
  site_title?: string;
  site_description?: string;
  site_og_image?: string;
  author_name?: string;
  author_avatar?: string;
}

const withHsts: PagesFunction<Env> = async (context) => {
  const response = await context.next();
  if (new URL(context.request.url).protocol !== "https:") return response;
  if (response.headers.has("Strict-Transport-Security")) return response;

  // Match the backend policy without overriding headers from downstream handlers.
  const secured = new Response(response.body, response);
  secured.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  return secured;
};

/** 清掉 index.html 里的默认 SEO 标签（title / description / canonical / og:* / twitter:*），
    由统一渲染器输出的完整片段替换；正则按标签类别匹配，不与具体值耦合 */
function stripDefaultSeoTags(html: string): string {
  return html
    .replace(/<title>[^<]*<\/title>\s*/i, "")
    .replace(/<meta\s+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+|description)["']\s+content=[^>]*>\s*/gi, "")
    .replace(/<link\s+rel=["']canonical["']\s+href=[^>]*>\s*/gi, "");
}

/** /posts/:slug.md → 后端 Markdown 输出（AI/Agent 友好内容接口）。
    Pages Functions 的 [param] 动态路由对带扩展名的路径支持不确定，统一在中间件分流最稳 */
const markdownProxy: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const mdMatch = new URL(request.url).pathname.match(/^\/posts\/([^/]+)\.md$/);
  if (!mdMatch) return context.next();

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const backend = getBackendUrl(context.env);
  if (!backend) return context.next();

  // 不透传客户端 headers，避免泄漏 Cookie / Authorization 给后端代理链路
  const res = await fetch(`${backend}/posts/${mdMatch[1]}.md`, {
    method,
    headers: { Accept: "text/markdown" },
  });
  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};

const prerender: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 仅处理文章页路径 /posts/:slug
  const postMatch = pathname.match(/^\/posts\/([^/]+)$/);
  if (!postMatch) {
    return context.next();
  }

  // 检测 User-Agent 是否为爬虫
  const ua = request.headers.get("user-agent") || "";
  if (!BOT_UA_REGEX.test(ua)) {
    // 普通用户 → 直接返回 SPA
    return context.next();
  }

  // 爬虫请求 → 从后端获取文章数据与公开站点设置
  const slug = postMatch[1];
  const backend = getBackendUrl(context.env);
  if (!backend) {
    return context.next();
  }

  try {
    const headers = { "User-Agent": "Monolith-Prerender/1.0" };
    const [apiResult, settingsResult] = await Promise.allSettled([
      fetch(`${backend}/api/posts/${slug}`, { headers }),
      fetch(`${backend}/api/settings/public`, { headers }),
    ]);
    if (apiResult.status === "rejected") return context.next();
    const apiRes = apiResult.value;

    if (!apiRes.ok) {
      // 文章不存在，返回正常 SPA 处理 404
      return context.next();
    }

    const post = (await apiRes.json()) as {
      title: string;
      excerpt: string;
      content: string;
      slug: string;
      tags: string[];
      createdAt: string;
      updatedAt: string;
      coverImage?: string | null;
    };
    const settings: PublicSeoSettings = settingsResult.status === "fulfilled" && settingsResult.value.ok
      ? await settingsResult.value.json()
      : {};

    const siteTitle = settings.site_title?.trim() || "Monolith";
    const site: SiteContext = {
      origin: url.origin,
      title: siteTitle,
      description: settings.site_description?.trim() || "",
      author: {
        name: settings.author_name?.trim() || siteTitle,
        ...(settings.author_avatar?.trim() ? { avatar: settings.author_avatar.trim() } : {}),
      },
      ...(settings.site_og_image?.trim() ? { ogImageDefault: settings.site_og_image.trim() } : {}),
      locale: "zh-CN",
    };

    // 描述：摘要优先，回退正文剥离 Markdown 标记后的前 160 字
    const description = post.excerpt?.trim() || stripMarkdown(post.content || "").slice(0, 160);

    const doc = buildPageDocument({
      path: `/posts/${post.slug}`,
      title: post.title,
      type: "article",
      description: description || null,
      contentMarkdown: post.content,
      coverImage: post.coverImage ?? null,
      publishedAt: post.createdAt,
      modifiedAt: post.updatedAt || null,
      tags: post.tags,
      breadcrumbs: [
        { name: "首页", url: "/" },
        { name: post.title, url: `/posts/${post.slug}` },
      ],
      site,
    });

    // 获取原始 index.html（用根路径请求静态资源），替换默认 SEO 标签后注入统一渲染结果
    const indexUrl = new URL("/", request.url);
    const assetRes = await context.env.ASSETS.fetch(new Request(indexUrl.toString()));
    let html = await assetRes.text();

    html = stripDefaultSeoTags(html);
    const head = `${renderSeoHead(doc)}\n    ${renderJsonLdScript(doc)}`;
    html = html.replace("</head>", `    ${head}\n  </head>`);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // 10 分钟窗口：文章编辑后爬虫侧最长延迟一档刷新，避免 24h 陈旧 head
        "Cache-Control": "public, max-age=600, s-maxage=600",
        "X-Robots-Tag": "index, follow",
      },
    });
  } catch {
    // 后端请求失败，回退到 SPA
    return context.next();
  }
};

export const onRequest = [withHsts, markdownProxy, prerender];
