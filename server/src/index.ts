/* ──────────────────────────────────────────────
   Monolith 博客后端 API
   路由层 — 只依赖 IDatabase / IObjectStorage 接口
   底层实现通过环境变量 DB_PROVIDER / STORAGE_PROVIDER 切换
   ────────────────────────────────────────────── */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { sign, verify } from "hono/jwt";
import { createDatabase, createObjectStorage } from "./storage/factory";
import type { IDatabase } from "./storage/interfaces";
import type { IObjectStorage } from "./storage/interfaces";

/* ── 类型定义 ──────────────────────────────── */
type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
  REACTION_SALT?: string;
  DB_PROVIDER?: string;
  STORAGE_PROVIDER?: string;
  WEBHOOK_URLS?: string; // 逗号分隔的 Webhook 目标地址
};

type Variables = {
  jwtPayload: { sub: string; exp: number };
  db: IDatabase;
  storage: IObjectStorage;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/* ── 全局中间件 ────────────────────────────── */
app.use("*", cors({
  origin: (origin) => origin || "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.use("*", async (c, next) => {
  await next();
  const headers = c.res.headers;
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (c.req.url.startsWith("https://")) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
});

// 注入存储实例到上下文（每次请求创建 — 在边缘环境中是无状态的）
app.use("*", async (c, next) => {
  c.set("db", await createDatabase(c.env as unknown as Record<string, unknown>));
  c.set("storage", createObjectStorage(c.env as unknown as Record<string, unknown>));
  await next();
});

// 边缘缓存策略：针对公开 API 的 GET 请求应用缓存
app.use("*", async (c, next) => {
  await next();
  const path = c.req.path;
  
  // 排除非 GET 请求、后台接口、以及请求失败的情况
  if (c.req.method !== "GET" || c.res.status !== 200 || path.startsWith("/api/admin")) return;
  
  // 仅对未设置 Cache-Control 的 /api/ 开始的公开端点设置缓存
  if (path.startsWith("/api/") && !c.res.headers.has("Cache-Control")) {
    c.res.headers.set("Cache-Control", "public, max-age=15, s-maxage=60, stale-while-revalidate=30");
  }
});

/* ── Webhook 通知辅助函数 ──────────────────────────── */
async function triggerWebhook(c: any, eventName: string, payload: any) {
  if (!c.env.WEBHOOK_URLS) return;
  const urls = c.env.WEBHOOK_URLS.split(",").map((u: string) => u.trim()).filter(Boolean);
  if (urls.length === 0) return;

  const data = JSON.stringify({ event: eventName, timestamp: new Date().toISOString(), payload });
  
  const promises = urls.map((url: string) => 
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: data })
      .catch(err => console.error("Webhook notification failed for", url, err))
  );

  if (c.executionCtx && c.executionCtx.waitUntil) {
    c.executionCtx.waitUntil(Promise.allSettled(promises));
  } else {
    Promise.allSettled(promises);
  }
}

/* ── 健康检查端点 ──────────────────────────── */
app.get("/api/health", async (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});
/* ── 公开 API ──────────────────────────────── */

// 获取文章列表（仅已发布）
app.get("/api/posts", async (c) => {
  const db = c.get("db");
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  const result = await db.getPublishedPosts();
  return c.json(result);
});

// 搜索文章
app.get("/api/search", async (c) => {
  const query = c.req.query("q") || "";
  if (!query.trim()) return c.json([]);
  let limit = parseInt(c.req.query("limit") || "20", 10);
  if (isNaN(limit) || limit <= 0) limit = 20;
  limit = Math.min(limit, 50);
  const db = c.get("db");
  const results = await db.searchPosts(query.trim(), limit);
  return c.json(results);
});

// 获取单篇文章（同时异步递增浏览量）
app.get("/api/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const post = await db.getPostBySlug(slug);
  if (!post) return c.json({ error: "文章未找到" }, 404);
  c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");

  // 异步递增浏览量 + 记录日访问量——不阻塞响应
  try {
    const viewPromise = db.incrementViewCount(slug);
    const dailyPromise = db.recordDailyView();

    // 采集访客信息
    const country = c.req.header("CF-IPCountry") || "XX";
    const referer = c.req.header("Referer") || "";
    let refererDomain = "";
    try { if (referer) refererDomain = new URL(referer).hostname; } catch { /* */ }
    const ua = (c.req.header("User-Agent") || "").toLowerCase();
    const deviceType = /bot|crawl|spider|slurp/i.test(ua) ? "bot"
      : /mobile|android|iphone/i.test(ua) ? "mobile"
      : /tablet|ipad/i.test(ua) ? "tablet" : "desktop";
    const visitPromise = db.recordVisit({ path: `/posts/${slug}`, country, refererDomain, deviceType });

    // 边缘环境中使用 waitUntil 确保异步任务完成
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(viewPromise);
      c.executionCtx.waitUntil(dailyPromise);
      c.executionCtx.waitUntil(visitPromise);
    } else {
      viewPromise.catch(() => {});
      dailyPromise.catch(() => {});
      visitPromise.catch(() => {});
    }
  } catch {
    /* 浏览量统计失败不影响文章返回 */
  }

  return c.json(post);
});

// 获取同系列文章列表
app.get("/api/series/:slug", async (c) => {
  const seriesSlug = c.req.param("slug");
  const db = c.get("db");
  const seriesPosts = await db.getSeriesPosts(seriesSlug);
  return c.json(seriesPosts);
});

// 获取所有标签
app.get("/api/tags", async (c) => {
  const db = c.get("db");
  const allTags = await db.getAllTags();
  return c.json(allTags);
});

// 获取所有分类
app.get("/api/categories", async (c) => {
  const db = c.get("db");
  const categories = await db.getCategories();
  return c.json(categories);
});

// 获取文章评论（仅已审核，不暴露邮箱）
app.get("/api/posts/:slug/comments", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const comments = await db.getApprovedComments(slug);
  const safe = comments.map(({ author_email, authorEmail, ...rest }: any) => rest);
  return c.json(safe);
});

// 提交评论（公开接口，需审核后才显示）
app.post("/api/posts/:slug/comments", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<{
    authorName: string;
    authorEmail?: string;
    content: string;
    _hp?: string; // honeypot 反垃圾字段
  }>();

  // Honeypot 反垃圾：如果隐藏字段被填写，静默拒绝
  if (body._hp) return c.json({ success: true, message: "评论已提交，等待审核" });

  if (!body.authorName?.trim() || !body.content?.trim()) {
    return c.json({ error: "昵称和评论内容不能为空" }, 400);
  }
  if (body.content.length > 2000) {
    return c.json({ error: "评论内容不能超过 2000 字" }, 400);
  }

  const db = c.get("db");
  try {
    await db.addComment({
      postSlug: slug,
      authorName: body.authorName.trim(),
      authorEmail: body.authorEmail?.trim() || "",
      content: body.content.trim(),
    });
    
    // 异步触发评论提醒邮件（Resend/Webhook）
    const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const resendKey = (c.env as any).RESEND_API_KEY;
    const adminEmail = (c.env as any).ADMIN_EMAIL;
    if (resendKey && adminEmail) {
      const emailPromise = fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Monolith Bot <onboarding@resend.dev>", // Resend 测试域名或需要替换为自有域名
          to: adminEmail,
          subject: `[Monolith] 新评论待审核: ${slug}`,
          html: `<p><strong>${escHtml(body.authorName.trim())}</strong> 刚刚在文章 <code>${escHtml(slug)}</code> 提交了评论：</p>
                 <blockquote style="border-left: 4px solid #eee; padding-left: 10px; color: #555;">${escHtml(body.content.trim())}</blockquote>
                 <p>邮箱: ${escHtml(body.authorEmail?.trim() || "无")}</p>
                 <p><a href="https://${new URL(c.req.url).hostname}/admin/comments">前往后台审核</a></p>`
        })
      }).catch(() => {});
      
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(emailPromise);
      }
    }

    return c.json({ success: true, message: "评论已提交，等待审核" });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "提交失败" }, 400);
  }
});

// 获取文章表情反应统计
app.get("/api/posts/:slug/reactions", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const reactions = await db.getReactions(slug);
  return c.json(reactions);
});

// 切换表情反应（无需登录，IP 去重）
app.post("/api/posts/:slug/reactions", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<{ type: string }>();

  const validTypes = ["like", "heart", "celebrate", "think"];
  if (!validTypes.includes(body.type)) {
    return c.json({ error: "无效的反应类型" }, 400);
  }

  // IP hash 去重（使用环境变量盐值，避免源码泄露后可反推）
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const reactionSalt = c.env.REACTION_SALT || "monolith-reaction-default";
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + ":" + reactionSalt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const ipHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  const db = c.get("db");
  const result = await db.toggleReaction(slug, body.type, ipHash);
  const reactions = await db.getReactions(slug);
  return c.json({ ...result, reactions });
});

// 公开：获取前台需要的设置（不含敏感信息）
app.get("/api/settings/public", async (c) => {
  const db = c.get("db");
  const all = await db.getSettings();
  return c.json({
    site_title: all.site_title || "Monolith",
    site_description: all.site_description || "",
    site_tagline: all.site_tagline || "",
    footer_text: all.footer_text || "",
    author_name: all.author_name || "Monolith",
    author_title: all.author_title || "",
    author_bio: all.author_bio || "",
    author_avatar: all.author_avatar || "",
    github_url: all.github_url || "",
    twitter_url: all.twitter_url || "",
    email: all.email || "",
    rss_enabled: all.rss_enabled || "true",
    custom_header: all.custom_header || "",
    custom_footer: all.custom_footer || "",
  });
});

// 公开流量统计（侧边栏折线图）
app.get("/api/stats/traffic", async (c) => {
  const db = c.get("db");
  const [chart, stats] = await Promise.all([
    db.getDailyViews(14),
    db.getViewStats(1),   // 只取 top1 即可，主要用 totalViews
  ]);
  return c.json({
    totalViews: stats.totalViews,
    totalPosts: stats.topPosts.length > 0 ? undefined : 0, // 前端已有文章数，无需重复传
    chart,
  });
});

// RSS 2.0 XML feed
app.get("/rss.xml", async (c) => {
  const db = c.get("db");

  // 检查 RSS 是否开启
  const rssEnabled = await db.getSetting("rss_enabled");
  if (rssEnabled === "false") return c.text("RSS 未开启", 404);

  // 读取站点信息
  const settings = await db.getSettings();
  const siteTitle = settings.site_title || "Monolith";
  const siteDesc = settings.site_description || "";
  const siteUrl = new URL(c.req.url).origin;

  // 获取最新 20 篇文章
  const allPosts = await db.getRecentPublishedPosts(20);

  const escXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const items = allPosts.map((p) => `    <item>
      <title>${escXml(p.title)}</title>
      <link>${siteUrl}/posts/${p.slug}</link>
      <guid isPermaLink="true">${siteUrl}/posts/${p.slug}</guid>
      <description>${escXml(p.excerpt || "")}</description>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
    </item>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(siteTitle)}</title>
    <link>${siteUrl}</link>
    <description>${escXml(siteDesc)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
});

// sitemap.xml — 动态站点地图
app.get("/sitemap.xml", async (c) => {
  const db = c.get("db");
  const siteUrl = new URL(c.req.url).origin;

  const allPosts = await db.getRecentPublishedPosts(1000);
  const allPages = await db.getPublishedPages();

  const escXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const urls: string[] = [];

  // 首页
  urls.push(`  <url>
    <loc>${escXml(siteUrl)}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);

  // 归档页
  urls.push(`  <url>
    <loc>${escXml(siteUrl)}/archive</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);

  // 文章
  for (const post of allPosts) {
    urls.push(`  <url>
    <loc>${escXml(siteUrl)}/posts/${escXml(post.slug)}</loc>
    ${(() => { const d = new Date(post.updatedAt || post.createdAt); return `<lastmod>${Number.isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0]}</lastmod>`; })()}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  // 独立页面
  for (const page of allPages) {
    urls.push(`  <url>
    <loc>${escXml(siteUrl)}/pages/${escXml(page.slug)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
});

// robots.txt — 爬虫规则
app.get("/robots.txt", (c) => {
  const siteUrl = new URL(c.req.url).origin;
  const txt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin

Sitemap: ${siteUrl}/sitemap.xml
`;
  return new Response(txt, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
});

/* ── 登录速率限制 ─────────────────────────── */
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const LOGIN_RATE_LIMIT = 5;       // 最多 5 次
const LOGIN_RATE_WINDOW = 15 * 60 * 1000; // 15 分钟窗口

/* ── 认证 API ──────────────────────────────── */

// 登录
app.post("/api/auth/login", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";

  // 速率限制
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && record.count >= LOGIN_RATE_LIMIT && (now - record.firstAttempt) < LOGIN_RATE_WINDOW) {
    return c.json({ error: "尝试次数过多，请稍后再试" }, 429);
  }
  if (!record || (now - record.firstAttempt) >= LOGIN_RATE_WINDOW) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }

  const body = await c.req.json<{ password: string }>();

  if (!body.password || body.password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: "密码错误" }, 401);
  }

  // 登录成功后清除速率限制
  loginAttempts.delete(ip);

  const now2 = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: "admin", iat: now2, exp: now2 + 60 * 60 * 24 * 7 },
    c.env.JWT_SECRET,
    "HS256"
  );

  return c.json({ token });
});

// 验证当前登录状态
app.get("/api/auth/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ authenticated: false });
  }
  try {
    await verify(authHeader.slice(7), c.env.JWT_SECRET, "HS256");
    return c.json({ authenticated: true, user: "admin" });
  } catch {
    return c.json({ authenticated: false });
  }
});

/* ── 管理 API（需要认证）─────────────────── */

// JWT 鉴权中间件
app.use("/api/admin/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "未认证" }, 401);
  }
  try {
    const payload = await verify(authHeader.slice(7), c.env.JWT_SECRET, "HS256");
    c.set("jwtPayload", payload as Variables["jwtPayload"]);
    await next();
  } catch {
    return c.json({ error: "认证无效或已过期" }, 401);
  }
});

// 获取所有文章（含未发布，管理后台用）
app.get("/api/admin/posts", async (c) => {
  const db = c.get("db");
  const result = await db.getAllPosts();
  return c.json(result);
});

// 阅读统计数据
app.get("/api/admin/stats", async (c) => {
  const db = c.get("db");
  const stats = await db.getViewStats(10);
  return c.json(stats);
});

// 访客分析数据
app.get("/api/admin/analytics", async (c) => {
  let days = parseInt(c.req.query("days") || "7", 10);
  if (isNaN(days) || days <= 0) days = 7;
  const db = c.get("db");
  const analytics = await db.getAnalytics(Math.min(days, 90));
  return c.json(analytics);
});

// 获取所有评论（管理后台）
app.get("/api/admin/comments", async (c) => {
  const db = c.get("db");
  const comments = await db.getAllComments();
  return c.json(comments);
});

// 审核评论
app.post("/api/admin/comments/:id/approve", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效 ID" }, 400);
  const db = c.get("db");
  const ok = await db.approveComment(id);
  if (!ok) return c.json({ error: "评论不存在" }, 404);
  return c.json({ success: true });
});

// 删除评论
app.delete("/api/admin/comments/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效 ID" }, 400);
  const db = c.get("db");
  const ok = await db.deleteComment(id);
  if (!ok) return c.json({ error: "评论不存在" }, 404);
  return c.json({ success: true });
});

// 创建文章
app.post("/api/admin/posts", async (c) => {
  const body = await c.req.json();
  const db = c.get("db");
  const newPost = await db.createPost(body);
  await triggerWebhook(c, "post_created", newPost);
  return c.json(newPost, 201);
});

// 更新文章（同时创建版本快照如果是自动保存外的核心提交，不过我们可以简化，在每次保存时如果内容变更较大则创建版本，或者直接在保存时暴露保存新版本的选项。这里我们在更新接口本身提供一个 saveVersion 参数，或者每次 updatePost 之后根据是否新建版本保存）
app.put("/api/admin/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json();
  const db = c.get("db");
  const updated = await db.updatePost(slug, body);
  if (!updated) return c.json({ error: "文章未找到" }, 404);
  
  if (body.saveVersion) {
    await db.createPostVersion(slug);
  }
  await triggerWebhook(c, "post_updated", updated);
  return c.json(updated);
});

// 获取文章历史版本
app.get("/api/admin/posts/:slug/versions", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const versions = await db.getPostVersions(slug);
  return c.json(versions);
});

// 恢复文章至指定版本
app.post("/api/admin/posts/:slug/versions/:id/restore", async (c) => {
  const slug = c.req.param("slug");
  const idStr = c.req.param("id");
  const db = c.get("db");
  const versionId = parseInt(idStr);
  if (isNaN(versionId)) return c.json({ error: "无效的快照 ID" }, 400);

  // 恢复前先将当前状态建立一个快照，以防后续后悔（保留 Undo 能力）
  await db.createPostVersion(slug);

  const post = await db.restorePostVersion(slug, versionId);
  if (!post) return c.json({ error: "恢复失败，版本或文章不存在" }, 400);
  
  return c.json({ success: true, post });
});

// 批量操作文章：发布 / 撤回发布 / 删除
app.post("/api/admin/posts/batch", async (c) => {
  const { slugs, action } = await c.req.json<{ slugs: string[]; action: "publish" | "unpublish" | "delete" }>();
  if (!["publish", "unpublish", "delete"].includes(action)) {
    return c.json({ error: "非法的批处理操作" }, 400);
  }
  if (!slugs || !Array.isArray(slugs) || slugs.length === 0) {
    return c.json({ error: "参数不正确" }, 400);
  }
  const db = c.get("db");
  const count = await db.batchOperatePosts(slugs, action);
  await triggerWebhook(c, "post_batch_operated", { action, slugs, count });
  return c.json({ success: true, count, message: `成功处理 ${count} 篇文章` });
});

// 删除文章
app.delete("/api/admin/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const deleted = await db.deletePost(slug);
  if (!deleted) return c.json({ error: "文章未找到" }, 404);
  await triggerWebhook(c, "post_deleted", { slug });
  return c.json({ success: true });
});

// ── 外链图片转本地 ─────────────────────────────

/** 从 Markdown 内容中提取所有外链图片 URL */
function extractExternalImageUrls(content: string): string[] {
  const urls = new Set<string>();
  const mdRegex = /!\[[^\]]*\]\(([^\s"')]+)/g;
  let match;
  while ((match = mdRegex.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !url.startsWith("/") && !url.startsWith("data:")) {
      try { new URL(url); urls.add(url); } catch { /* non-URL skip */ }
    }
  }
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = imgRegex.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !url.startsWith("/") && !url.startsWith("data:")) {
      try { new URL(url); urls.add(url); } catch { /* skip */ }
    }
  }
  return Array.from(urls);
}

/** SSRF 防护：仅允许 https:// 开头的外部图片地址 */
function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.|169\.254\.)/.test(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// 单篇文章：外链图片转本地
app.post("/api/admin/posts/:slug/localize-images", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const storage = c.get("storage");

  const post = await db.getPostBySlug(slug);
  if (!post) return c.json({ error: "文章未找到" }, 404);

  const externalUrls = extractExternalImageUrls(post.content);
  if (externalUrls.length === 0) {
    return c.json({ replaced: 0, failed: 0, message: "未发现外链图片" });
  }

  let replaced = 0;
  let failed = 0;
  const errors: string[] = [];
  let content = post.content;

  for (const url of externalUrls) {
    if (!isSafeImageUrl(url)) {
      failed++;
      errors.push(`${url}: 仅允许 HTTPS 外部图片地址`);
      continue;
    }
    try {
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), 10000); // 10秒超时
      const resp = await fetch(url, { headers: { "User-Agent": "Monolith-Bot/1.0" }, signal: abortCtrl.signal });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const contentLength = resp.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) throw new Error("图片超过 10MB 限制");

      const contentType = resp.headers.get("content-type") || "image/png";
      const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg"
        : contentType.includes("png") ? "png"
        : contentType.includes("gif") ? "gif"
        : contentType.includes("webp") ? "webp"
        : contentType.includes("svg") ? "svg"
        : "png";

      const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const arrayBuf = await resp.arrayBuffer();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(arrayBuf));
          controller.close();
        },
      });
      await storage.put(key, stream, { contentType });

      const localUrl = `/cdn/${key}`;
      // 全局替换该 URL（Markdown 和 HTML 中都替换）
      content = content.split(url).join(localUrl);
      replaced++;
    } catch (err) {
      failed++;
      errors.push(`${url}: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }

  // 只在有替换时更新文章
  if (replaced > 0) {
    await db.updatePost(slug, { content });
  }

  return c.json({ replaced, failed, total: externalUrls.length, errors });
});

// 批量：所有文章外链图片转本地
app.post("/api/admin/localize-all-images", async (c) => {
  const db = c.get("db");
  const storage = c.get("storage");
  const allPosts = await db.getAllPosts();

  let totalReplaced = 0;
  let totalFailed = 0;
  const results: { slug: string; title: string; replaced: number; failed: number }[] = [];

  for (const post of allPosts) {
    const externalUrls = extractExternalImageUrls(post.content);
    if (externalUrls.length === 0) continue;

    let replaced = 0;
    let failed = 0;
    let content = post.content;

    for (const url of externalUrls) {
      if (!isSafeImageUrl(url)) { failed++; continue; }
      try {
        const resp = await fetch(url, { headers: { "User-Agent": "Monolith-Bot/1.0" } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const contentType = resp.headers.get("content-type") || "image/png";
        const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg"
          : contentType.includes("png") ? "png"
          : contentType.includes("gif") ? "gif"
          : contentType.includes("webp") ? "webp"
          : contentType.includes("svg") ? "svg"
          : "png";

        const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const arrayBuf = await resp.arrayBuffer();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(arrayBuf));
            controller.close();
          },
        });
        await storage.put(key, stream, { contentType });
        content = content.split(url).join(`/cdn/${key}`);
        replaced++;
      } catch {
        failed++;
      }
    }

    if (replaced > 0) {
      await db.updatePost(post.slug, { content });
    }

    totalReplaced += replaced;
    totalFailed += failed;
    results.push({ slug: post.slug, title: post.title, replaced, failed });
  }

  return c.json({ totalReplaced, totalFailed, posts: results });
});

// 上传图片
app.post("/api/admin/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return c.json({ error: "未提供文件" }, 400);

  const ext = file.name.split(".").pop() || "png";
  const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const storage = c.get("storage");
  await storage.put(key, file.stream(), { contentType: file.type });

  return c.json({ url: `/cdn/${key}`, key });
});

// 媒体库：列出所有上传的文件
app.get("/api/admin/media", async (c) => {
  const storage = c.get("storage");
  const items = await storage.list("uploads/", 500);

  const media = items.map((obj) => ({
    key: obj.key,
    name: obj.key.replace("uploads/", ""),
    url: `/cdn/${obj.key}`,
    size: obj.size,
    uploaded: obj.uploaded,
  }));
  media.sort((a, b) => b.uploaded.localeCompare(a.uploaded));

  return c.json(media);
});

// 媒体库：删除指定文件
app.delete("/api/admin/media/:key{.+}", async (c) => {
  const key = c.req.param("key");
  if (!key.startsWith("uploads/")) {
    return c.json({ error: "只能删除 uploads/ 下的文件" }, 400);
  }
  const storage = c.get("storage");
  await storage.delete(key);
  return c.json({ success: true });
});

// 通过 Worker 代理访问存储文件
app.get("/cdn/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const storage = c.get("storage");
  const object = await storage.get(key);

  if (!object) return c.json({ error: "文件未找到" }, 404);

  const headers = new Headers();
  object.writeHeaders(headers);

  // 图片：长缓存 + Vary 允许 CF 边缘按格式缓存
  const isImage = /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i.test(key);
  if (isImage) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Vary", "Accept");
  }

  return new Response(object.body, { headers });
});

/* ── 站点设置 ──────────────────────────────── */

app.get("/api/admin/settings", async (c) => {
  const db = c.get("db");
  const settings = await db.getSettings();
  return c.json(settings);
});

app.put("/api/admin/settings", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<Record<string, string>>();
  await db.saveSettings(body);
  return c.json({ success: true });
});

/* ── 数据备份 ──────────────────────────────── */

// 导出备份 JSON
app.get("/api/admin/backup/export", async (c) => {
  const db = c.get("db");
  const data = await db.exportAll();
  return c.json(data);
});

// 备份到对象存储
app.post("/api/admin/backup/r2", async (c) => {
  const db = c.get("db");
  const storage = c.get("storage");

  const data = await db.exportAll();
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `backups/monolith-backup-${timestamp}.json`;

  await storage.put(key, json, {
    contentType: "application/json",
    customMetadata: { type: "backup", version: "1.0" },
  });

  return c.json({ success: true, key, size: json.length, timestamp: data.exportedAt });
});

// 列出备份历史
app.get("/api/admin/backup/r2-list", async (c) => {
  const storage = c.get("storage");
  const items = await storage.list("backups/", 50);

  const backups = items.map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    name: obj.key.replace("backups/", ""),
  }));
  backups.sort((a, b) => b.uploaded.localeCompare(a.uploaded));

  return c.json(backups);
});

// 删除备份
app.post("/api/admin/backup/r2-delete", async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name) return c.json({ error: "缺少文件名" }, 400);

  const storage = c.get("storage");
  await storage.delete(`backups/${name}`);

  return c.json({ success: true });
});

// 预览备份内容摘要
app.post("/api/admin/backup/r2-preview", async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  const storage = c.get("storage");
  const object = await storage.get(`backups/${name}`);

  if (!object) return c.json({ error: "备份文件不存在" }, 404);

  const reader = object.body.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const result = await reader.read();
    if (result.value) chunks.push(result.value);
    done = result.done;
  }
  const text = new TextDecoder().decode(new Uint8Array(chunks.flatMap((c) => [...c])));

  try {
    const data = JSON.parse(text);
    return c.json({
      version: data.version || "unknown",
      exportedAt: data.exportedAt || "unknown",
      postCount: data.posts?.length || 0,
      tagCount: data.tags?.length || 0,
      postTitles: (data.posts || []).slice(0, 10).map((p: { title: string; slug: string }) => ({ title: p.title, slug: p.slug })),
      settingsKeys: Object.keys(data.settings || {}),
    });
  } catch {
    return c.json({ error: "备份文件格式无效" }, 400);
  }
});

// 从 JSON 文件恢复/导入数据
app.post("/api/admin/backup/restore", async (c) => {
  const body = await c.req.json();
  const db = c.get("db");

  try {
    const imported = await db.importAll({
      posts: body.posts,
      tags: body.tags,
      settings: body.settings,
      mode: body.mode || "merge",
    });
    return c.json({ success: true, imported, mode: body.mode || "merge" });
  } catch (err) {
    return c.json({ error: `恢复失败: ${err instanceof Error ? err.message : "未知错误"}` }, 500);
  }
});

// 从 R2 备份文件直接恢复数据（真正的恢复逻辑）
app.post("/api/admin/backup/r2-restore", async (c) => {
  const { name, mode } = await c.req.json<{ name: string; mode?: "merge" | "overwrite" }>();
  if (!name) return c.json({ error: "缺少备份文件名" }, 400);

  const storage = c.get("storage");
  const db = c.get("db");

  const object = await storage.get(`backups/${name}`);
  if (!object) return c.json({ error: "备份文件不存在" }, 404);

  // 读取完整备份内容
  const reader = object.body.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const result = await reader.read();
    if (result.value) chunks.push(result.value);
    done = result.done;
  }
  const text = new TextDecoder().decode(new Uint8Array(chunks.flatMap((c) => [...c])));

  let data: { posts?: unknown[]; tags?: unknown[]; settings?: Record<string, string> };
  try {
    data = JSON.parse(text);
  } catch {
    return c.json({ error: "备份文件格式无效，无法解析 JSON" }, 400);
  }

  if (!data.posts && !data.tags && !data.settings) {
    return c.json({ error: "备份文件缺少有效数据字段（posts / tags / settings）" }, 400);
  }

  try {
    const imported = await db.importAll({
      posts: data.posts as Parameters<typeof db.importAll>[0]["posts"],
      tags: data.tags as Parameters<typeof db.importAll>[0]["tags"],
      settings: data.settings,
      mode: mode || "merge",
    });
    return c.json({ success: true, imported, source: name, mode: mode || "merge" });
  } catch (err) {
    return c.json({ error: `恢复失败: ${err instanceof Error ? err.message : "未知错误"}` }, 500);
  }
});



// WebDAV 备份
app.post("/api/admin/backup/webdav", async (c) => {
  const body = await c.req.json<{
    url: string; username: string; password: string; path?: string;
  }>();

  // SSRF 防护：仅允许 https:// 的外部 URL
  try {
    const parsed = new URL(body.url);
    if (parsed.protocol !== "https:") {
      return c.json({ error: "仅允许 HTTPS 协议的 WebDAV 地址" }, 400);
    }
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|::1|fc)/.test(parsed.hostname)) {
      return c.json({ error: "不允许内网地址" }, 400);
    }
  } catch {
    return c.json({ error: "无效的 WebDAV 地址" }, 400);
  }

  const db = c.get("db");
  const data = await db.exportAll();
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `monolith-backup-${timestamp}.json`;
  const remotePath = (body.path || "/").replace(/\/$/, "");
  const fullUrl = `${body.url.replace(/\/$/, "")}${remotePath}/${filename}`;

  try {
    await fetch(`${body.url.replace(/\/$/, "")}${remotePath}/`, {
      method: "MKCOL",
      headers: { Authorization: "Basic " + btoa(`${body.username}:${body.password}`) },
    }).catch(() => {});

    const res = await fetch(fullUrl, {
      method: "PUT",
      headers: {
        Authorization: "Basic " + btoa(`${body.username}:${body.password}`),
        "Content-Type": "application/json",
      },
      body: json,
    });

    if (!res.ok && res.status !== 201 && res.status !== 204) {
      return c.json({ error: `WebDAV 上传失败: ${res.status} ${res.statusText}` }, 500);
    }

    return c.json({ success: true, url: fullUrl, size: json.length, timestamp: data.exportedAt });
  } catch (err) {
    return c.json({ error: `WebDAV 连接失败: ${err instanceof Error ? err.message : "未知错误"}` }, 500);
  }
});

// ── Halo 博客数据导入 ─────────────────────────

/** 将 Halo 导出的 JSON 数据转换为 Monolith 的导入格式 */
function convertHaloData(haloData: any): {
  posts: any[];
  tags: { name: string }[];
  preview: { postCount: number; tagCount: number; categoryCount: number; commentCount: number };
} {
  // 构建 tag ID → name 映射
  const tagMap = new Map<number, string>();
  const tags: { name: string }[] = [];
  if (Array.isArray(haloData.tags)) {
    for (const t of haloData.tags) {
      tagMap.set(t.id, t.name);
      tags.push({ name: t.name });
    }
  }

  // 构建 category ID → name 映射（分类也作为标签导入）
  const catMap = new Map<number, string>();
  if (Array.isArray(haloData.categories)) {
    for (const c of haloData.categories) {
      catMap.set(c.id, c.name);
      if (!tags.find((t) => t.name === c.name)) {
        tags.push({ name: c.name });
      }
    }
  }

  // 构建 postId → tag names 映射
  const postTagNames = new Map<number, string[]>();
  if (Array.isArray(haloData.post_tags)) {
    for (const pt of haloData.post_tags) {
      const name = tagMap.get(pt.tagId);
      if (name) {
        if (!postTagNames.has(pt.postId)) postTagNames.set(pt.postId, []);
        postTagNames.get(pt.postId)!.push(name);
      }
    }
  }
  // 分类也关联到文章标签
  if (Array.isArray(haloData.post_categories)) {
    for (const pc of haloData.post_categories) {
      const name = catMap.get(pc.categoryId);
      if (name) {
        if (!postTagNames.has(pc.postId)) postTagNames.set(pc.postId, []);
        const arr = postTagNames.get(pc.postId)!;
        if (!arr.includes(name)) arr.push(name);
      }
    }
  }

  // 转换文章
  const posts: any[] = [];
  if (Array.isArray(haloData.posts)) {
    for (const p of haloData.posts) {
      // Halo 1.x 用 originalContent（Markdown），2.x 可能用 content.raw
      const content = p.originalContent || p.content?.raw || p.formatContent || "";
      const excerpt = p.summary || p.excerpt || "";
      const slug = p.slug || `post-${p.id}`;
      const title = p.title || "无标题";

      // 状态映射（Halo 1.x: 0=PUBLISHED, 1=DRAFT, 2=RECYCLE）
      const status = p.status;
      const published = status === "PUBLISHED" || status === "published" || status === 0 || status === "0";
      const pinned = Number(p.topPriority || p.priority || 0) > 0;

      posts.push({
        slug,
        title,
        content,
        excerpt,
        published,
        pinned,
        listed: true,
        tags: postTagNames.get(p.id) || [],
      });
    }
  }

  return {
    posts,
    tags,
    preview: {
      postCount: posts.length,
      tagCount: tags.length,
      categoryCount: catMap.size,
      commentCount: Array.isArray(haloData.comments) ? haloData.comments.length : 0,
    },
  };
}

// 预览 Halo 导入数据（不写入）
app.post("/api/admin/import/halo/preview", async (c) => {
  try {
    const haloData = await c.req.json();
    const result = convertHaloData(haloData);
    return c.json({
      success: true,
      preview: result.preview,
      postTitles: result.posts.slice(0, 20).map((p: any) => ({ title: p.title, slug: p.slug })),
      tagNames: result.tags.map((t) => t.name),
    });
  } catch (err) {
    return c.json({ error: `解析 Halo 数据失败: ${err instanceof Error ? err.message : "格式错误"}` }, 400);
  }
});

// 正式导入 Halo 数据
app.post("/api/admin/import/halo", async (c) => {
  try {
    const body = await c.req.json();
    const haloData = body.data || body;
    const mode = body.mode || "merge";
    const db = c.get("db");

    const { posts, tags } = convertHaloData(haloData);

    const imported = await db.importAll({
      posts,
      tags,
      mode,
    });

    return c.json({ success: true, imported, mode });
  } catch (err) {
    return c.json({ error: `导入失败: ${err instanceof Error ? err.message : "未知错误"}` }, 500);
  }
});

/* ── 独立页 API ─────────────────────────────── */


// 公开：获取已发布的独立页列表（导航用）
app.get("/api/pages", async (c) => {
  const db = c.get("db");
  const allPages = await db.getPublishedPages();
  return c.json(allPages);
});

// 公开：获取单个独立页内容
app.get("/api/pages/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const page = await db.getPublishedPageBySlug(slug);
  if (!page) return c.json({ error: "页面不存在" }, 404);
  return c.json(page);
});

// 管理：获取所有独立页（含未发布）
app.get("/api/admin/pages", async (c) => {
  const db = c.get("db");
  const allPages = await db.getAllPages();
  return c.json(allPages);
});

// 管理：获取单个独立页
app.get("/api/admin/pages/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const page = await db.getPageBySlug(slug);
  if (!page) return c.json({ error: "页面不存在" }, 404);
  return c.json(page);
});

// 管理：创建或更新独立页
app.post("/api/admin/pages", async (c) => {
  const body = await c.req.json();
  const db = c.get("db");
  const result = await db.upsertPage(body);
  return c.json({ success: true, slug: body.slug, action: result.action });
});

// 管理：删除独立页
app.post("/api/admin/pages/delete", async (c) => {
  const { slug } = await c.req.json<{ slug: string }>();
  const db = c.get("db");
  await db.deletePage(slug);
  return c.json({ success: true });
});

/* ── Durable Object / 导出 ──────────────────── */
export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    const db = await createDatabase(env as unknown as Record<string, unknown>);
    const count = await db.publishScheduledPosts();
    if (count > 0) {
      console.log(`[Cron] Published ${count} scheduled posts.`);
    }
  }
};
