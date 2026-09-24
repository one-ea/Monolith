import { getBackendUrl } from "./_shared";

// Cloudflare Pages Function — 爬虫预渲染中间件
// 拦截社交平台/搜索引擎爬虫，注入文章专属 OG 标签
// 普通用户请求不受影响，直接返回 SPA

const BOT_UA_REGEX =
  /bot|crawl|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Embedly|Quora Link Preview|Showyoubot|outbrain|pinterest|vkShare|W3C_Validator|baiduspider|yandex|sogou|360Spider/i;

interface Env {
  API_BASE: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
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

  // 爬虫请求 → 从后端获取文章数据
  const slug = postMatch[1];
  const backend = getBackendUrl(context.env);
  if (!backend) {
    return context.next();
  }

  try {
    const apiRes = await fetch(`${backend}/api/posts/${slug}`, {
      headers: { "User-Agent": "Monolith-Prerender/1.0" },
    });

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
    };

    // 获取原始 index.html（用根路径请求静态资源）
    const indexUrl = new URL("/", request.url);
    const assetRes = await context.env.ASSETS.fetch(new Request(indexUrl.toString()));
    let html = await assetRes.text();

    // 循环清理 HTML 标签（防止嵌套标签如 <scr<script>ipt> 绕过）
    const stripHtml = (s: string) => {
      let result = s;
      let prev = "";
      while (prev !== result) {
        prev = result;
        result = result.replace(/<[^>]*>?/g, "");
      }
      return result.replace(/\s+/g, " ").trim();
    };
    const description = post.excerpt || (post.content ? stripHtml(post.content).slice(0, 160) : "");
    const siteOrigin = url.origin;
    const articleUrl = `${siteOrigin}/posts/${post.slug}`;
    const ogImage = `${siteOrigin}/og-default.png`;

    // 转义 HTML 特殊字符
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 替换 <title>
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(post.title)} | Monolith</title>`);

    // 替换 OG 标签
    html = html.replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
      `$1${esc(post.title)}$2`
    );
    html = html.replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${esc(description)}$2`
    );
    html = html.replace(
      /(<meta\s+property="og:type"\s+content=")[^"]*(")/,
      `$1article$2`
    );
    html = html.replace(
      /(<meta\s+property="og:image"\s+content=")[^"]*(")/i,
      `$1${ogImage}$2`
    );

    // 替换 Twitter Card 标签
    html = html.replace(
      /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
      `$1${esc(post.title)}$2`
    );
    html = html.replace(
      /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
      `$1${esc(description)}$2`
    );

    // 替换 meta description
    html = html.replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      `$1${esc(description)}$2`
    );

    // 注入 canonical URL 和 article 元数据（在 </head> 前插入）
    const extraMeta = [
      `<link rel="canonical" href="${esc(articleUrl)}" />`,
      `<meta property="og:url" content="${esc(articleUrl)}" />`,
      `<meta property="article:published_time" content="${esc(post.createdAt)}" />`,
      post.updatedAt ? `<meta property="article:modified_time" content="${esc(post.updatedAt)}" />` : "",
      ...(post.tags || []).map((tag) => `<meta property="article:tag" content="${esc(tag)}" />`),
    ]
      .filter(Boolean)
      .join("\n    ");

    html = html.replace("</head>", `    ${extraMeta}\n  </head>`);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Robots-Tag": "index, follow",
      },
    });
  } catch {
    // 后端请求失败，回退到 SPA
    return context.next();
  }
};

export const onRequest = [withHsts, prerender];
