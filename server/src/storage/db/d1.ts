/* ──────────────────────────────────────────────
   D1 适配器 — Cloudflare D1 (SQLite) 实现
   通过 Drizzle ORM 操作，复用现有 schema
   ────────────────────────────────────────────── */

import { drizzle } from "drizzle-orm/d1";
import { eq, desc, sql } from "drizzle-orm";
import { posts, tags, postTags, pages, comments } from "../../db/schema";
import type {
  IDatabase, Post, PostSummary, Tag, Page, PageSummary,
  CreatePostInput, UpdatePostInput, UpsertPageInput,
  BackupData, ImportResult, ViewStats, Comment, CreateCommentInput,
} from "../interfaces";

type DrizzleD1 = ReturnType<typeof drizzle>;

export class D1Adapter implements IDatabase {
  private db: DrizzleD1;
  private schemaReady: Promise<void> | null = null;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 确保数据库 schema 完整（动态补全所有后添加的列和表）
   * 在工厂创建实例后立即调用
   */
  async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        await this.ensureViewCountColumn();
        await this.ensurePinnedColumn();
        await this.ensureSettingsTable();
        await this.ensurePagesTable();
        await this.ensureCommentsTable();
      })();
    }
    await this.schemaReady;
  }

  /* ── 内部辅助 ─────────────────── */

  private async getPostTags(postId: number): Promise<string[]> {
    const rows = await this.db
      .select({ name: tags.name })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, postId));
    return rows.map((r) => r.name);
  }

  private async syncPostTags(postId: number, tagNames: string[]): Promise<void> {
    // 清除旧关联
    await this.db.delete(postTags).where(eq(postTags.postId, postId));
    // 建立新关联
    for (const tagName of tagNames) {
      await this.db.insert(tags).values({ name: tagName }).onConflictDoNothing();
      const [tag] = await this.db
        .select()
        .from(tags)
        .where(eq(tags.name, tagName))
        .limit(1);
      if (tag) {
        await this.db
          .insert(postTags)
          .values({ postId, tagId: tag.id })
          .onConflictDoNothing();
      }
    }
  }

  private async ensureSettingsTable(): Promise<void> {
    await this.db.run(
      sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
    );
  }

  private async ensureViewCountColumn(): Promise<void> {
    try {
      await this.db.run(sql`ALTER TABLE posts ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0`);
    } catch {
      /* 字段已存在，忽略 */
    }
  }

  private async ensurePinnedColumn(): Promise<void> {
    try {
      await this.db.run(sql`ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
    } catch {
      /* 字段已存在，忽略 */
    }
    try {
      await this.db.run(sql`ALTER TABLE posts ADD COLUMN publish_at TEXT`);
    } catch {
      /* 字段已存在，忽略 */
    }
  }

  private async ensurePagesTable(): Promise<void> {
    await this.db.run(sql`CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      show_in_nav INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  }

  private async ensureCommentsTable(): Promise<void> {
    await this.db.run(sql`CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  }

  /* ── 文章 ─────────────────────── */

  async getPublishedPosts(): Promise<PostSummary[]> {
    const allPosts = await this.db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        coverColor: posts.coverColor,
        createdAt: posts.createdAt,
        pinned: posts.pinned,
        publishAt: posts.publishAt,
      })
      .from(posts)
      .where(
        sql`${posts.published} = 1 AND (${posts.publishAt} IS NULL OR ${posts.publishAt} <= datetime('now'))`
      )
      .orderBy(desc(posts.pinned), desc(posts.createdAt));

    return Promise.all(
      allPosts.map(async (post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt || "",
        coverColor: post.coverColor || "",
        createdAt: post.createdAt,
        tags: await this.getPostTags(post.id),
        pinned: post.pinned,
        publishAt: post.publishAt,
      }))
    );
  }

  async getAllPosts(): Promise<(Post & { tags: string[] })[]> {
    const allPosts = await this.db
      .select()
      .from(posts)
      .orderBy(desc(posts.createdAt));

    return Promise.all(
      allPosts.map(async (post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || "",
        coverColor: post.coverColor || "",
        published: post.published,
        listed: post.listed,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        viewCount: post.viewCount ?? 0,
        pinned: post.pinned,
        publishAt: post.publishAt,
        tags: await this.getPostTags(post.id),
      }))
    );
  }

  async getPostBySlug(slug: string): Promise<(Post & { tags: string[] }) | null> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);

    if (!post) return null;

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt || "",
      coverColor: post.coverColor || "",
      published: post.published,
      listed: post.listed,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      viewCount: post.viewCount ?? 0,
      pinned: post.pinned,
      publishAt: post.publishAt,
      tags: await this.getPostTags(post.id),
    };
  }

  async createPost(data: CreatePostInput): Promise<Post> {
    const [newPost] = await this.db
      .insert(posts)
      .values({
        slug: data.slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || "",
        coverColor: data.coverColor || "from-gray-500/20 to-gray-600/20",
        published: data.published ?? true,
        listed: data.listed ?? true,
        pinned: data.pinned ?? false,
        publishAt: data.publishAt || null,
      })
      .returning();

    if (data.tags?.length) {
      await this.syncPostTags(newPost.id, data.tags);
    }

    return {
      id: newPost.id,
      slug: newPost.slug,
      title: newPost.title,
      content: newPost.content,
      excerpt: newPost.excerpt || "",
      coverColor: newPost.coverColor || "",
      published: newPost.published,
      listed: newPost.listed,
      createdAt: newPost.createdAt,
      updatedAt: newPost.updatedAt,
      viewCount: 0,
      pinned: newPost.pinned,
      publishAt: newPost.publishAt,
    };
  }

  async updatePost(slug: string, data: UpdatePostInput): Promise<Post | null> {
    const [existing] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);

    if (!existing) return null;

    const [updated] = await this.db
      .update(posts)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
        ...(data.coverColor !== undefined && { coverColor: data.coverColor }),
        ...(data.published !== undefined && { published: data.published }),
        ...(data.listed !== undefined && { listed: data.listed }),
        ...(data.pinned !== undefined && { pinned: data.pinned }),
        ...(data.publishAt !== undefined && { publishAt: data.publishAt }),
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(posts.id, existing.id))
      .returning();

    if (data.tags !== undefined) {
      await this.syncPostTags(existing.id, data.tags);
    }

    return {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      content: updated.content,
      excerpt: updated.excerpt || "",
      coverColor: updated.coverColor || "",
      published: updated.published,
      listed: updated.listed,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      viewCount: updated.viewCount ?? 0,
      pinned: updated.pinned,
      publishAt: updated.publishAt,
    };
  }

  async deletePost(slug: string): Promise<boolean> {
    const result = await this.db.delete(posts).where(eq(posts.slug, slug)).returning();
    return result.length > 0;
  }

  /* ── 标签 ─────────────────────── */

  async getAllTags(): Promise<Tag[]> {
    return this.db.select().from(tags).orderBy(tags.name);
  }

  /* ── 独立页 ───────────────────── */

  async getPublishedPages(): Promise<PageSummary[]> {
    await this.ensurePagesTable();
    return this.db
      .select({
        slug: pages.slug,
        title: pages.title,
        showInNav: pages.showInNav,
        sortOrder: pages.sortOrder,
      })
      .from(pages)
      .where(eq(pages.published, true))
      .orderBy(pages.sortOrder);
  }

  async getAllPages(): Promise<Page[]> {
    await this.ensurePagesTable();
    const rows = await this.db.select().from(pages).orderBy(pages.sortOrder);
    return rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content,
      sortOrder: p.sortOrder,
      published: p.published,
      showInNav: p.showInNav,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async getPageBySlug(slug: string): Promise<Page | null> {
    await this.ensurePagesTable();
    const [page] = await this.db.select().from(pages).where(eq(pages.slug, slug));
    if (!page) return null;
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      sortOrder: page.sortOrder,
      published: page.published,
      showInNav: page.showInNav,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  async getPublishedPageBySlug(slug: string): Promise<Page | null> {
    const page = await this.getPageBySlug(slug);
    if (!page || !page.published) return null;
    return page;
  }

  async upsertPage(data: UpsertPageInput): Promise<{ action: "created" | "updated" }> {
    await this.ensurePagesTable();
    const existing = await this.db
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.slug, data.slug));

    if (existing.length > 0) {
      await this.db.update(pages).set({
        title: data.title,
        content: data.content,
        sortOrder: data.sortOrder ?? 0,
        published: data.published ?? true,
        showInNav: data.showInNav ?? false,
        updatedAt: new Date().toISOString(),
      }).where(eq(pages.slug, data.slug));
      return { action: "updated" };
    } else {
      await this.db.insert(pages).values({
        slug: data.slug,
        title: data.title,
        content: data.content,
        sortOrder: data.sortOrder ?? 0,
        published: data.published ?? true,
        showInNav: data.showInNav ?? false,
      });
      return { action: "created" };
    }
  }

  async deletePage(slug: string): Promise<boolean> {
    const result = await this.db.delete(pages).where(eq(pages.slug, slug)).returning();
    return result.length > 0;
  }

  /* ── 设置 ─────────────────────── */

  async getSettings(): Promise<Record<string, string>> {
    try {
      const rows = await this.db.run(sql`SELECT key, value FROM settings`);
      const settings: Record<string, string> = {};
      for (const row of rows.results || []) {
        settings[(row as { key: string }).key] = (row as { value: string }).value;
      }
      return settings;
    } catch {
      await this.ensureSettingsTable();
      return {};
    }
  }

  async getSetting(key: string): Promise<string | null> {
    try {
      const rows = await this.db.run(
        sql`SELECT value FROM settings WHERE key = ${key}`
      );
      const row = rows.results?.[0] as { value: string } | undefined;
      return row?.value ?? null;
    } catch {
      return null;
    }
  }

  async saveSettings(settings: Record<string, string>): Promise<void> {
    await this.ensureSettingsTable();
    for (const [key, value] of Object.entries(settings)) {
      await this.db.run(
        sql`INSERT INTO settings (key, value) VALUES (${key}, ${value}) ON CONFLICT(key) DO UPDATE SET value = ${value}`
      );
    }
  }

  /* ── 流量统计 ─────────────────── */

  private async ensureDailyViewsTable(): Promise<void> {
    await this.db.run(sql`CREATE TABLE IF NOT EXISTS daily_views (date TEXT NOT NULL PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)`);
  }

  async recordDailyView(): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await this.db.run(
        sql`INSERT INTO daily_views (date, count) VALUES (${today}, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1`
      );
    } catch {
      await this.ensureDailyViewsTable();
      const today = new Date().toISOString().slice(0, 10);
      await this.db.run(
        sql`INSERT INTO daily_views (date, count) VALUES (${today}, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1`
      );
    }
  }

  async getDailyViews(days: number): Promise<{ date: string; count: number }[]> {
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const rows = await this.db.run(
        sql`SELECT date, count FROM daily_views WHERE date >= ${since} ORDER BY date ASC`
      );
      return (rows.results || []).map((r: any) => ({ date: r.date, count: r.count }));
    } catch {
      await this.ensureDailyViewsTable();
      return [];
    }
  }

  async getTotalViews(): Promise<number> {
    try {
      const rows = await this.db.run(sql`SELECT COALESCE(SUM(count), 0) as total FROM daily_views`);
      return (rows.results?.[0] as any)?.total ?? 0;
    } catch {
      return 0;
    }
  }

  /* ── 备份与恢复 ───────────────── */

  async exportAll(): Promise<BackupData> {
    const allPosts = await this.db.select().from(posts).orderBy(desc(posts.createdAt));
    const allTags = await this.db.select().from(tags);
    const allPostTags = await this.db.select().from(postTags);
    const settings = await this.getSettings();

    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      posts: allPosts.map((p) => ({
        ...p,
        excerpt: p.excerpt || "",
        coverColor: p.coverColor || "",
      })),
      tags: allTags,
      postTags: allPostTags,
      settings,
      meta: {
        postCount: allPosts.length,
        tagCount: allTags.length,
      },
    };
  }

  async importAll(data: {
    posts?: CreatePostInput[];
    tags?: { name: string }[];
    settings?: Record<string, string>;
    mode?: "merge" | "overwrite";
  }): Promise<ImportResult> {
    const mode = data.mode || "merge";
    const imported: ImportResult = { posts: 0, tags: 0, settings: 0 };

    // 恢复标签
    if (data.tags?.length) {
      for (const tag of data.tags) {
        try {
          await this.db.insert(tags).values({ name: tag.name }).onConflictDoNothing();
          imported.tags++;
        } catch { /* 已存在 */ }
      }
    }

    // 恢复文章
    if (data.posts?.length) {
      for (const post of data.posts) {
        const existing = await this.db
          .select({ id: posts.id })
          .from(posts)
          .where(eq(posts.slug, post.slug));

        if (existing.length > 0) {
          if (mode === "overwrite") {
            await this.db.update(posts).set({
              title: post.title,
              content: post.content,
              excerpt: post.excerpt || "",
              coverColor: post.coverColor || "",
              published: post.published ?? true,
              updatedAt: new Date().toISOString(),
            }).where(eq(posts.slug, post.slug));
            imported.posts++;
          }
        } else {
          await this.db.insert(posts).values({
            slug: post.slug,
            title: post.title,
            content: post.content,
            excerpt: post.excerpt || "",
            coverColor: post.coverColor || "",
            published: post.published ?? true,
            listed: post.listed ?? true,
            pinned: post.pinned ?? false,
            publishAt: post.publishAt || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          imported.posts++;
        }
      }
    }

    // 恢复设置
    if (data.settings && Object.keys(data.settings).length > 0) {
      await this.saveSettings(data.settings);
      imported.settings = Object.keys(data.settings).length;
    }

    return imported;
  }

  /* ── 搜索 ─────────────────────── */

  async searchPosts(query: string, limit = 20): Promise<PostSummary[]> {
    const pattern = `%${query}%`;
    const rows = await this.db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        coverColor: posts.coverColor,
        createdAt: posts.createdAt,
        pinned: posts.pinned,
        publishAt: posts.publishAt,
      })
      .from(posts)
      .where(
        // 只搜索 title 和 excerpt，避免对大字段 content 做全表 LIKE 扫描
        sql`${posts.published} = 1 AND (${posts.publishAt} IS NULL OR ${posts.publishAt} <= datetime('now')) AND (${posts.title} LIKE ${pattern} OR ${posts.excerpt} LIKE ${pattern})`
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit);


    return Promise.all(
      rows.map(async (post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt || "",
        coverColor: post.coverColor || "",
        createdAt: post.createdAt,
        tags: await this.getPostTags(post.id),
        pinned: post.pinned,
        publishAt: post.publishAt,
      }))
    );
  }

  /* ── 阅读统计 ───────────────────── */

  async incrementViewCount(slug: string): Promise<void> {
    await this.ensureViewCountColumn();
    await this.db.run(
      sql`UPDATE posts SET view_count = view_count + 1 WHERE slug = ${slug}`
    );
  }

  async getViewStats(topN = 10): Promise<ViewStats> {
    await this.ensureViewCountColumn();
    const totalResult = await this.db.run(
      sql`SELECT COALESCE(SUM(view_count), 0) as total FROM posts`
    );
    const totalViews = (totalResult.results?.[0] as { total: number } | undefined)?.total ?? 0;

    const topPosts = await this.db
      .select({
        slug: posts.slug,
        title: posts.title,
        viewCount: posts.viewCount,
      })
      .from(posts)
      .where(eq(posts.published, true))
      .orderBy(desc(posts.viewCount))
      .limit(topN);

    return {
      totalViews,
      topPosts: topPosts.map((p) => ({
        slug: p.slug,
        title: p.title,
        viewCount: p.viewCount ?? 0,
      })),
    };
  }

  /* ── RSS 专用 ─────────────────── */

  async getRecentPublishedPosts(limit: number) {
    const rows = await this.db
      .select({
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        content: posts.content,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.published, true))
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    return rows.map((r) => ({ ...r, excerpt: r.excerpt || "" }));
  }

  /* ── 评论 ─────────────────── */

  async getApprovedComments(postSlug: string): Promise<Comment[]> {
    await this.ensureCommentsTable();
    const result = await this.db.run(
      sql`SELECT c.id, c.post_id, c.author_name, c.author_email, c.content, c.approved, c.created_at
          FROM comments c
          INNER JOIN posts p ON c.post_id = p.id
          WHERE p.slug = ${postSlug} AND c.approved = 1
          ORDER BY c.created_at ASC`
    );
    type Row = Record<string, unknown>;
    return (result.results as Row[] || []).map((r) => ({
      id: r.id as number,
      postId: r.post_id as number,
      authorName: r.author_name as string,
      authorEmail: r.author_email as string || "",
      content: r.content as string,
      approved: Boolean(r.approved),
      createdAt: r.created_at as string,
    }));
  }

  async addComment(input: CreateCommentInput): Promise<Comment> {
    await this.ensureCommentsTable();
    // 查找文章 ID
    const [post] = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, input.postSlug))
      .limit(1);
    if (!post) throw new Error("文章不存在");

    const [newComment] = await this.db
      .insert(comments)
      .values({
        postId: post.id,
        authorName: input.authorName,
        authorEmail: input.authorEmail || "",
        content: input.content,
        approved: false,
      })
      .returning();

    return {
      id: newComment.id,
      postId: newComment.postId,
      authorName: newComment.authorName,
      authorEmail: newComment.authorEmail,
      content: newComment.content,
      approved: newComment.approved,
      createdAt: newComment.createdAt,
    };
  }

  async getAllComments(): Promise<(Comment & { postSlug: string; postTitle: string })[]> {
    await this.ensureCommentsTable();
    const result = await this.db.run(
      sql`SELECT c.id, c.post_id, c.author_name, c.author_email, c.content, c.approved, c.created_at,
                 p.slug as post_slug, p.title as post_title
          FROM comments c
          INNER JOIN posts p ON c.post_id = p.id
          ORDER BY c.created_at DESC`
    );
    type JoinRow = Record<string, unknown>;
    return (result.results as JoinRow[] || []).map((r) => ({
      id: r.id as number,
      postId: r.post_id as number,
      authorName: r.author_name as string,
      authorEmail: r.author_email as string || "",
      content: r.content as string,
      approved: Boolean(r.approved),
      createdAt: r.created_at as string,
      postSlug: r.post_slug as string,
      postTitle: r.post_title as string,
    }));
  }

  async approveComment(id: number): Promise<boolean> {
    await this.ensureCommentsTable();
    const result = await this.db
      .update(comments)
      .set({ approved: true })
      .where(eq(comments.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteComment(id: number): Promise<boolean> {
    await this.ensureCommentsTable();
    const result = await this.db
      .delete(comments)
      .where(eq(comments.id, id))
      .returning();
    return result.length > 0;
  }

  async getCommentCount(postSlug: string): Promise<number> {
    await this.ensureCommentsTable();
    const result = await this.db.run(
      sql`SELECT COUNT(*) as count FROM comments c
          INNER JOIN posts p ON c.post_id = p.id
          WHERE p.slug = ${postSlug} AND c.approved = 1`
    );
    return (result.results?.[0] as { count: number } | undefined)?.count ?? 0;
  }
}
