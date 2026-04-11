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
  DB_PROVIDER?: string;
  STORAGE_PROVIDER?: string;
};

type Variables = {
  jwtPayload: { sub: string; exp: number };
  db: IDatabase;
  storage: IObjectStorage;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/* ── 全局中间件 ────────────────────────────── */
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// 注入存储实例到上下文（每次请求创建 — 在边缘环境中是无状态的）
app.use("*", async (c, next) => {
  c.set("db", await createDatabase(c.env as unknown as Record<string, unknown>));
  c.set("storage", createObjectStorage(c.env as unknown as Record<string, unknown>));
  await next();
});

/* ── 公开 API ──────────────────────────────── */

// 获取文章列表（仅已发布）
app.get("/api/posts", async (c) => {
  const db = c.get("db");
  const result = await db.getPublishedPosts();
  return c.json(result);
});

// 搜索文章
app.get("/api/search", async (c) => {
  const query = c.req.query("q") || "";
  if (!query.trim()) return c.json([]);
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
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

  // 异步递增浏览量 + 记录日访问量——不阻塞响应
  try {
    const viewPromise = db.incrementViewCount(slug);
    const dailyPromise = db.recordDailyView();
    // 边缘环境中使用 waitUntil 确保异步任务完成
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(viewPromise);
      c.executionCtx.waitUntil(dailyPromise);
    } else {
      viewPromise.catch(() => {});
      dailyPromise.catch(() => {});
    }
  } catch {
    /* 浏览量统计失败不影响文章返回 */
  }

  return c.json(post);
});

// 获取所有标签
app.get("/api/tags", async (c) => {
  const db = c.get("db");
  const allTags = await db.getAllTags();
  return c.json(allTags);
});

// 获取文章评论（仅已审核）
app.get("/api/posts/:slug/comments", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const comments = await db.getApprovedComments(slug);
  return c.json(comments);
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
    return c.json({ success: true, message: "评论已提交，等待审核" });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "提交失败" }, 400);
  }
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
    <lastmod>${new Date(post.createdAt).toISOString().split("T")[0]}</lastmod>
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

/* ── 认证 API ──────────────────────────────── */

// 登录
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ password: string }>();

  if (!body.password || body.password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: "密码错误" }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: "admin", iat: now, exp: now + 60 * 60 * 24 * 7 },
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
  return c.json(newPost, 201);
});

// 更新文章
app.put("/api/admin/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json();
  const db = c.get("db");
  const updated = await db.updatePost(slug, body);
  if (!updated) return c.json({ error: "文章未找到" }, 404);
  return c.json(updated);
});

// 删除文章
app.delete("/api/admin/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = c.get("db");
  const deleted = await db.deletePost(slug);
  if (!deleted) return c.json({ error: "文章未找到" }, 404);
  return c.json({ success: true });
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

/* ── 健康检查 ──────────────────────────────── */
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
