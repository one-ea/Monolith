/* ──────────────────────────────────────────────
   PostgreSQL 适配器
   通过 postgres.js + Drizzle ORM 操作
   支持：Neon / Supabase / 自建 PG / 任何 PostgreSQL
   ────────────────────────────────────────────── */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { pgPosts, pgTags, pgPostTags, pgPages, pgSettings, pgComments, pgReactions, pgVisits, pgPostVersions } from "../../db/schema-pg";
import type {
  IDatabase, Post, PostSummary, Tag, Page, PageSummary,
  CreatePostInput, UpdatePostInput, UpsertPageInput,
  BackupData, ImportResult, ViewStats, Comment, CreateCommentInput, PostVersion
} from "../interfaces";

type DrizzlePG = ReturnType<typeof drizzle>;

export class PostgresAdapter implements IDatabase {
  private db: DrizzlePG;
  private client: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    // postgres.js 自动支持连接池
    this.client = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.client);
  }

  /* ── 自动建表 ─────────────────── */

  async ensureCoreTables(): Promise<void> {
    await this.client`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        excerpt TEXT DEFAULT '',
        cover_color TEXT DEFAULT 'from-gray-500/20 to-gray-600/20',
        cover_image TEXT DEFAULT '',
        published BOOLEAN NOT NULL DEFAULT true,
        listed BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        view_count INTEGER NOT NULL DEFAULT 0
      )
    `;
    /* 确保旧表也有对应字段 */
    await this.client`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0
    `.catch(() => {});
    await this.client`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false
    `.catch(() => {});
    await this.client`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ
    `.catch(() => {});
    await this.client`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS series_slug TEXT
    `.catch(() => {});
    await this.client`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT ''
    `.catch(() => {});
    await this.client`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS series_order INTEGER DEFAULT 0
    `.catch(() => {});
    await this.client`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT ''
    `.catch(() => {});
    await this.client`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `;
    await this.client`
      CREATE TABLE IF NOT EXISTS post_tags (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, tag_id)
      )
    `;
    await this.client`
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        published BOOLEAN NOT NULL DEFAULT true,
        show_in_nav BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await this.client`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    await this.client`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_name TEXT NOT NULL,
        author_email TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        approved BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await this.client`
      CREATE TABLE IF NOT EXISTS post_versions (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await this.client`
      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        post_slug TEXT NOT NULL REFERENCES posts(slug) ON DELETE CASCADE,
        type TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(post_slug, type, ip_hash)
      )
    `;
    await this.client`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'XX',
        referer_domain TEXT NOT NULL DEFAULT '',
        device_type TEXT NOT NULL DEFAULT 'desktop',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  /* ── 内部辅助 ─────────────────── */

  private async getPostTags(postId: number): Promise<string[]> {
    const rows = await this.db
      .select({ name: pgTags.name })
      .from(pgPostTags)
      .innerJoin(pgTags, eq(pgPostTags.tagId, pgTags.id))
      .where(eq(pgPostTags.postId, postId));
    return rows.map((r) => r.name);
  }

  private async syncPostTags(postId: number, tagNames: string[]): Promise<void> {
    await this.db.delete(pgPostTags).where(eq(pgPostTags.postId, postId));
    for (const tagName of tagNames) {
      await this.db.insert(pgTags).values({ name: tagName }).onConflictDoNothing();
      const [tag] = await this.db
        .select()
        .from(pgTags)
        .where(eq(pgTags.name, tagName))
        .limit(1);
      if (tag) {
        await this.db
          .insert(pgPostTags)
          .values({ postId, tagId: tag.id })
          .onConflictDoNothing();
      }
    }
  }

  private async getPostTagsMap(postIds: number[]): Promise<Map<number, string[]>> {
    const tagMap = new Map<number, string[]>();
    if (postIds.length === 0) return tagMap;

    const rows = await this.db
      .select({ postId: pgPostTags.postId, name: pgTags.name })
      .from(pgPostTags)
      .innerJoin(pgTags, eq(pgPostTags.tagId, pgTags.id))
      .where(inArray(pgPostTags.postId, postIds));

    for (const row of rows) {
      const list = tagMap.get(row.postId) || [];
      list.push(row.name);
      tagMap.set(row.postId, list);
    }

    return tagMap;
  }

  /** 将 PG timestamp 转为 ISO 字符串 */
  private ts(d: Date | string | null): string {
    if (!d) return new Date().toISOString();
    return d instanceof Date ? d.toISOString() : d;
  }

  /* ── 文章 ─────────────────────── */

  async getPublishedPosts(): Promise<PostSummary[]> {
    const allPosts = await this.db
      .select({
        id: pgPosts.id,
        slug: pgPosts.slug,
        title: pgPosts.title,
        excerpt: pgPosts.excerpt,
        coverColor: pgPosts.coverColor,
        coverImage: pgPosts.coverImage,
        createdAt: pgPosts.createdAt,
        pinned: pgPosts.pinned,
        publishAt: pgPosts.publishAt,
        seriesSlug: pgPosts.seriesSlug,
        category: pgPosts.category,
      })
      .from(pgPosts)
      .where(
        sql`${pgPosts.published} = true AND (${pgPosts.publishAt} IS NULL OR ${pgPosts.publishAt} <= NOW())`
      )
      .orderBy(desc(pgPosts.pinned), desc(pgPosts.createdAt));

    const tagMap = await this.getPostTagsMap(allPosts.map((post) => post.id));

    return allPosts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || "",
      coverColor: post.coverColor || "",
      coverImage: post.coverImage || "",
      createdAt: this.ts(post.createdAt),
      tags: tagMap.get(post.id) || [],
      pinned: post.pinned,
      publishAt: this.ts(post.publishAt),
      seriesSlug: post.seriesSlug || null,
      category: post.category || "",
    }));
  }

  async getAllPosts(): Promise<(Post & { tags: string[] })[]> {
    const allPosts = await this.db
      .select()
      .from(pgPosts)
      .orderBy(desc(pgPosts.createdAt));

    const tagMap = await this.getPostTagsMap(allPosts.map((post) => post.id));

    return allPosts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt || "",
      coverColor: post.coverColor || "",
      coverImage: post.coverImage || "",
      published: post.published,
      listed: post.listed,
      createdAt: this.ts(post.createdAt),
      updatedAt: this.ts(post.updatedAt),
      viewCount: post.viewCount ?? 0,
      pinned: post.pinned,
      publishAt: this.ts(post.publishAt),
      seriesSlug: post.seriesSlug || null,
      category: post.category || "",
      seriesOrder: post.seriesOrder ?? 0,
      tags: tagMap.get(post.id) || [],
    }));
  }

  async getPostBySlug(slug: string): Promise<(Post & { tags: string[] }) | null> {
    const [post] = await this.db
      .select()
      .from(pgPosts)
      .where(eq(pgPosts.slug, slug))
      .limit(1);

    if (!post) return null;

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt || "",
      coverColor: post.coverColor || "",
      coverImage: post.coverImage || "",
      published: post.published,
      listed: post.listed,
      createdAt: this.ts(post.createdAt),
      updatedAt: this.ts(post.updatedAt),
      viewCount: post.viewCount ?? 0,
      pinned: post.pinned,
      publishAt: this.ts(post.publishAt),
      seriesSlug: post.seriesSlug || null,
      category: post.category || "",
      seriesOrder: post.seriesOrder ?? 0,
      tags: await this.getPostTags(post.id),
    };
  }

  async createPost(data: CreatePostInput): Promise<Post> {
    const [newPost] = await this.db
      .insert(pgPosts)
      .values({
        slug: data.slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || "",
        coverColor: data.coverColor || "from-gray-500/20 to-gray-600/20",
        coverImage: data.coverImage || "",
        published: data.published ?? true,
        listed: data.listed ?? true,
        pinned: data.pinned ?? false,
        publishAt: data.publishAt ? sql`${data.publishAt}::timestamptz` : null,
        seriesSlug: data.seriesSlug || null,
        category: data.category || "",
        seriesOrder: data.seriesOrder ?? 0,
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
      coverImage: newPost.coverImage || "",
      published: newPost.published,
      listed: newPost.listed,
      createdAt: this.ts(newPost.createdAt),
      updatedAt: this.ts(newPost.updatedAt),
      viewCount: 0,
      pinned: newPost.pinned,
      publishAt: this.ts(newPost.publishAt),
      seriesSlug: newPost.seriesSlug || null,
      category: newPost.category || "",
      seriesOrder: newPost.seriesOrder ?? 0,
    };
  }

  async updatePost(slug: string, data: UpdatePostInput): Promise<Post | null> {
    const [existing] = await this.db
      .select()
      .from(pgPosts)
      .where(eq(pgPosts.slug, slug))
      .limit(1);

    if (!existing) return null;

    const [updated] = await this.db
      .update(pgPosts)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
        ...(data.coverColor !== undefined && { coverColor: data.coverColor }),
        ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
        ...(data.published !== undefined && { published: data.published }),
        ...(data.listed !== undefined && { listed: data.listed }),
        ...(data.pinned !== undefined && { pinned: data.pinned }),
        ...(data.publishAt !== undefined && { publishAt: data.publishAt ? sql`${data.publishAt}::timestamptz` : null }),
        ...(data.seriesSlug !== undefined && { seriesSlug: data.seriesSlug }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.seriesOrder !== undefined && { seriesOrder: data.seriesOrder }),
        updatedAt: sql`NOW()`,
      })
      .where(eq(pgPosts.id, existing.id))
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
      coverImage: updated.coverImage || "",
      published: updated.published,
      listed: updated.listed,
      createdAt: this.ts(updated.createdAt),
      updatedAt: this.ts(updated.updatedAt),
      viewCount: updated.viewCount ?? 0,
      pinned: updated.pinned,
      publishAt: this.ts(updated.publishAt),
      seriesSlug: updated.seriesSlug || null,
      category: updated.category || "",
      seriesOrder: updated.seriesOrder ?? 0,
    };
  }

  async deletePost(slug: string): Promise<boolean> {
    const result = await this.db.delete(pgPosts).where(eq(pgPosts.slug, slug)).returning();
    return result.length > 0;
  }

  async batchOperatePosts(slugs: string[], action: "publish" | "unpublish" | "delete"): Promise<number> {
    if (!slugs || slugs.length === 0) return 0;
    if (action === "delete") {
      const result = await this.db.delete(pgPosts).where(inArray(pgPosts.slug, slugs)).returning();
      return result.length;
    } else {
      const published = action === "publish";
      const result = await this.db.update(pgPosts)
        .set({ published, updatedAt: new Date() })
        .where(inArray(pgPosts.slug, slugs))
        .returning();
      return result.length;
    }
  }

  async publishScheduledPosts(): Promise<number> {
    const result = await this.db
      .update(pgPosts)
      .set({ published: true })
      .where(
        sql`${pgPosts.published} = false AND ${pgPosts.publishAt} IS NOT NULL AND ${pgPosts.publishAt} <= NOW()`
      )
      .returning();
    return result.length;
  }

  /* ── 历史版本 ─────────────────────── */

  async getPostVersions(slug: string): Promise<PostVersion[]> {
    const post = await this.db.select({ id: pgPosts.id }).from(pgPosts).where(eq(pgPosts.slug, slug));
    if (!post || post.length === 0) return [];
    
    const versions = await this.db.select().from(pgPostVersions).where(eq(pgPostVersions.postId, post[0].id)).orderBy(desc(pgPostVersions.createdAt));
    return versions.map(v => ({
      ...v,
      id: v.id,
      postId: v.postId,
      createdAt: v.createdAt.toISOString()
    }));
  }

  async createPostVersion(slug: string): Promise<boolean> {
    const post = await this.db.select().from(pgPosts).where(eq(pgPosts.slug, slug));
    if (!post || post.length === 0) return false;
    await this.db.insert(pgPostVersions).values({
      postId: post[0].id,
      title: post[0].title,
      content: post[0].content,
      excerpt: post[0].excerpt,
    });
    return true;
  }

  async restorePostVersion(slug: string, versionId: number): Promise<Post | null> {
    const post = await this.db.select({ id: pgPosts.id }).from(pgPosts).where(eq(pgPosts.slug, slug));
    if (!post || post.length === 0) return null;
    const version = await this.db.select().from(pgPostVersions).where(eq(pgPostVersions.id, versionId));
    if (!version || version.length === 0 || version[0].postId !== post[0].id) return null;

    // 更新当前文章
    await this.db.update(pgPosts).set({
      title: version[0].title,
      content: version[0].content,
      excerpt: version[0].excerpt,
      updatedAt: new Date(),
    }).where(eq(pgPosts.id, post[0].id));

    return this.getPostBySlug(slug) as Promise<Post | null>;
  }

  /* ── 标签 ─────────────────────── */

  async getAllTags(): Promise<Tag[]> {
    return this.db.select().from(pgTags).orderBy(pgTags.name);
  }

  /* ── 独立页 ───────────────────── */

  async getPublishedPages(): Promise<PageSummary[]> {
    return this.db
      .select({
        slug: pgPages.slug,
        title: pgPages.title,
        showInNav: pgPages.showInNav,
        sortOrder: pgPages.sortOrder,
      })
      .from(pgPages)
      .where(eq(pgPages.published, true))
      .orderBy(pgPages.sortOrder);
  }

  async getAllPages(): Promise<Page[]> {
    const rows = await this.db.select().from(pgPages).orderBy(pgPages.sortOrder);
    return rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content,
      sortOrder: p.sortOrder,
      published: p.published,
      showInNav: p.showInNav,
      createdAt: this.ts(p.createdAt),
      updatedAt: this.ts(p.updatedAt),
    }));
  }

  async getPageBySlug(slug: string): Promise<Page | null> {
    const [page] = await this.db.select().from(pgPages).where(eq(pgPages.slug, slug));
    if (!page) return null;
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      sortOrder: page.sortOrder,
      published: page.published,
      showInNav: page.showInNav,
      createdAt: this.ts(page.createdAt),
      updatedAt: this.ts(page.updatedAt),
    };
  }

  async getPublishedPageBySlug(slug: string): Promise<Page | null> {
    const page = await this.getPageBySlug(slug);
    if (!page || !page.published) return null;
    return page;
  }

  async upsertPage(data: UpsertPageInput): Promise<{ action: "created" | "updated" }> {
    const existing = await this.db
      .select({ id: pgPages.id })
      .from(pgPages)
      .where(eq(pgPages.slug, data.slug));

    if (existing.length > 0) {
      await this.db.update(pgPages).set({
        title: data.title,
        content: data.content,
        sortOrder: data.sortOrder ?? 0,
        published: data.published ?? true,
        showInNav: data.showInNav ?? false,
        updatedAt: sql`NOW()`,
      }).where(eq(pgPages.slug, data.slug));
      return { action: "updated" };
    } else {
      await this.db.insert(pgPages).values({
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
    const result = await this.db.delete(pgPages).where(eq(pgPages.slug, slug)).returning();
    return result.length > 0;
  }

  /* ── 设置 ─────────────────────── */

  async getSettings(): Promise<Record<string, string>> {
    const rows = await this.db.select().from(pgSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  async getSetting(key: string): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(pgSettings)
      .where(eq(pgSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  }

  async saveSettings(settings: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await this.db
        .insert(pgSettings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: pgSettings.key,
          set: { value },
        });
    }
  }

  /* ── 流量统计 ─────────────────── */

  private async ensureDailyViewsTable(): Promise<void> {
    await this.db.execute(sql`CREATE TABLE IF NOT EXISTS daily_views (date TEXT NOT NULL PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)`);
  }

  async recordDailyView(): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await this.db.execute(
        sql`INSERT INTO daily_views (date, count) VALUES (${today}, 1) ON CONFLICT(date) DO UPDATE SET count = daily_views.count + 1`
      );
    } catch {
      await this.ensureDailyViewsTable();
      const today = new Date().toISOString().slice(0, 10);
      await this.db.execute(
        sql`INSERT INTO daily_views (date, count) VALUES (${today}, 1) ON CONFLICT(date) DO UPDATE SET count = daily_views.count + 1`
      );
    }
  }

  async getDailyViews(days: number): Promise<{ date: string; count: number }[]> {
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const rows = await this.db.execute(
        sql`SELECT date, count FROM daily_views WHERE date >= ${since} ORDER BY date ASC`
      );
      return (Array.isArray(rows) ? rows : []).map((r: any) => ({ date: r.date, count: r.count }));
    } catch {
      await this.ensureDailyViewsTable();
      return [];
    }
  }

  async getTotalViews(): Promise<number> {
    try {
      const rows = await this.db.execute(sql`SELECT COALESCE(SUM(count), 0) as total FROM daily_views`);
      const result = Array.isArray(rows) ? rows : [];
      return (result[0] as any)?.total ?? 0;
    } catch {
      return 0;
    }
  }

  /* ── 备份与恢复 ───────────────── */

  async exportAll(): Promise<BackupData> {
    const allPosts = await this.db.select().from(pgPosts).orderBy(desc(pgPosts.createdAt));
    const allTags = await this.db.select().from(pgTags);
    const allPostTags = await this.db.select().from(pgPostTags);
    const settings = await this.getSettings();

    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      posts: allPosts.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        content: p.content,
        excerpt: p.excerpt || "",
        coverColor: p.coverColor || "",
        coverImage: p.coverImage || "",
        published: p.published,
        listed: p.listed,
        createdAt: this.ts(p.createdAt),
        updatedAt: this.ts(p.updatedAt),
        viewCount: p.viewCount ?? 0,
        pinned: p.pinned,
        publishAt: this.ts(p.publishAt),
        seriesSlug: p.seriesSlug || null,
        category: p.category || "",
        seriesOrder: p.seriesOrder ?? 0,
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

    if (data.tags?.length) {
      for (const tag of data.tags) {
        try {
          await this.db.insert(pgTags).values({ name: tag.name }).onConflictDoNothing();
          imported.tags++;
        } catch { /* 已存在 */ }
      }
    }

    if (data.posts?.length) {
      for (const post of data.posts) {
        const existing = await this.db
          .select({ id: pgPosts.id })
          .from(pgPosts)
          .where(eq(pgPosts.slug, post.slug));

        if (existing.length > 0) {
          if (mode === "overwrite") {
            await this.db.update(pgPosts).set({
              title: post.title,
              content: post.content,
              excerpt: post.excerpt || "",
              coverColor: post.coverColor || "",
              coverImage: post.coverImage || "",
              published: post.published ?? true,
              listed: post.listed ?? true,
              pinned: post.pinned ?? false,
              publishAt: post.publishAt ? sql`${post.publishAt}::timestamptz` : null,
              updatedAt: sql`NOW()`,
            }).where(eq(pgPosts.slug, post.slug));
            imported.posts++;
          }
        } else {
          await this.db.insert(pgPosts).values({
            slug: post.slug,
            title: post.title,
            content: post.content,
            excerpt: post.excerpt || "",
            coverColor: post.coverColor || "",
            coverImage: post.coverImage || "",
            published: post.published ?? true,
            listed: post.listed ?? true,
            pinned: post.pinned ?? false,
            publishAt: post.publishAt ? sql`${post.publishAt}::timestamptz` : null,
          });
          imported.posts++;
        }
      }
    }

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
        id: pgPosts.id,
        slug: pgPosts.slug,
        title: pgPosts.title,
        excerpt: pgPosts.excerpt,
        coverColor: pgPosts.coverColor,
        coverImage: pgPosts.coverImage,
        createdAt: pgPosts.createdAt,
        pinned: pgPosts.pinned,
        publishAt: pgPosts.publishAt,
        seriesSlug: pgPosts.seriesSlug,
        category: pgPosts.category,
      })
      .from(pgPosts)
      .where(
        sql`${pgPosts.published} = true AND (${pgPosts.publishAt} IS NULL OR ${pgPosts.publishAt} <= NOW()) AND (${pgPosts.title} ILIKE ${pattern} OR ${pgPosts.content} ILIKE ${pattern} OR ${pgPosts.excerpt} ILIKE ${pattern})`
      )
      .orderBy(desc(pgPosts.createdAt))
      .limit(limit);

    return Promise.all(
      rows.map(async (post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt || "",
        coverColor: post.coverColor || "",
        coverImage: post.coverImage || "",
        createdAt: this.ts(post.createdAt),
        tags: await this.getPostTags(post.id),
        pinned: post.pinned,
        publishAt: this.ts(post.publishAt),
        seriesSlug: post.seriesSlug || null,
        category: post.category || "",
      }))
    );
  }

  /* ── 阅读统计 ───────────────────── */

  async incrementViewCount(slug: string): Promise<void> {
    await this.db
      .update(pgPosts)
      .set({ viewCount: sql`${pgPosts.viewCount} + 1` })
      .where(eq(pgPosts.slug, slug));
  }

  async getViewStats(topN = 10): Promise<ViewStats> {
    const [totalRow] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${pgPosts.viewCount}), 0)` })
      .from(pgPosts);

    const topPosts = await this.db
      .select({
        slug: pgPosts.slug,
        title: pgPosts.title,
        viewCount: pgPosts.viewCount,
      })
      .from(pgPosts)
      .where(eq(pgPosts.published, true))
      .orderBy(desc(pgPosts.viewCount))
      .limit(topN);

    return {
      totalViews: Number(totalRow?.total ?? 0),
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
        slug: pgPosts.slug,
        title: pgPosts.title,
        excerpt: pgPosts.excerpt,
        content: pgPosts.content,
        createdAt: pgPosts.createdAt,
        updatedAt: pgPosts.updatedAt,
      })
      .from(pgPosts)
      .where(eq(pgPosts.published, true))
      .orderBy(desc(pgPosts.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      excerpt: r.excerpt || "",
      createdAt: this.ts(r.createdAt),
      updatedAt: this.ts(r.updatedAt),
    }));
  }

  /* ── 评论 ─────────────────── */

  async getApprovedComments(postSlug: string): Promise<Comment[]> {
    type Row = { id: number; post_id: number; author_name: string; author_email: string; content: string; approved: boolean; created_at: Date };
    const rows = await this.client<Row[]>`
      SELECT c.id, c.post_id, c.author_name, c.author_email, c.content, c.approved, c.created_at
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE p.slug = ${postSlug} AND c.approved = true
      ORDER BY c.created_at ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      postId: r.post_id,
      authorName: r.author_name,
      authorEmail: r.author_email || "",
      content: r.content,
      approved: r.approved,
      createdAt: this.ts(r.created_at),
    }));
  }

  async addComment(input: CreateCommentInput): Promise<Comment> {
    // 查找文章 ID
    const [post] = await this.db
      .select({ id: pgPosts.id })
      .from(pgPosts)
      .where(eq(pgPosts.slug, input.postSlug))
      .limit(1);
    if (!post) throw new Error("文章不存在");

    const [newComment] = await this.db
      .insert(pgComments)
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
      createdAt: this.ts(newComment.createdAt),
    };
  }

  async getAllComments(): Promise<(Comment & { postSlug: string; postTitle: string })[]> {
    type Row = { id: number; post_id: number; author_name: string; author_email: string; content: string; approved: boolean; created_at: Date; post_slug: string; post_title: string };
    const rows = await this.client<Row[]>`
      SELECT c.id, c.post_id, c.author_name, c.author_email, c.content, c.approved, c.created_at,
             p.slug as post_slug, p.title as post_title
      FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      ORDER BY c.created_at DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      postId: r.post_id,
      authorName: r.author_name,
      authorEmail: r.author_email || "",
      content: r.content,
      approved: r.approved,
      createdAt: this.ts(r.created_at),
      postSlug: r.post_slug,
      postTitle: r.post_title,
    }));
  }

  async approveComment(id: number): Promise<boolean> {
    const result = await this.db
      .update(pgComments)
      .set({ approved: true })
      .where(eq(pgComments.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteComment(id: number): Promise<boolean> {
    const result = await this.db
      .delete(pgComments)
      .where(eq(pgComments.id, id))
      .returning();
    return result.length > 0;
  }

  async getCommentCount(postSlug: string): Promise<number> {
    const [row] = await this.client`
      SELECT COUNT(*)::int as count FROM comments c
      INNER JOIN posts p ON c.post_id = p.id
      WHERE p.slug = ${postSlug} AND c.approved = true
    `;
    return row?.count ?? 0;
  }

  async getSeriesPosts(seriesSlug: string): Promise<{ slug: string; title: string; seriesOrder: number }[]> {
    const rows = await this.client`
      SELECT slug, title, series_order FROM posts
      WHERE series_slug = ${seriesSlug} AND published = true AND (publish_at IS NULL OR publish_at <= NOW())
      ORDER BY series_order ASC
    `;
    return rows.map(r => ({ slug: r.slug as string, title: r.title as string, seriesOrder: (r.series_order as number) ?? 0 }));
  }

  async getCategories(): Promise<{ name: string; count: number }[]> {
    const rows = await this.client`
      SELECT category as name, COUNT(*)::int as count FROM posts
      WHERE published = true AND (publish_at IS NULL OR publish_at <= NOW()) AND category != '' AND category IS NOT NULL
      GROUP BY category ORDER BY count DESC
    `;
    return rows.map(r => ({ name: r.name as string, count: r.count as number }));
  }

  async getReactions(postSlug: string): Promise<Record<string, number>> {
    await this.ensureCoreTables();
    const rows = await this.client`
      SELECT type, COUNT(*)::int as count FROM reactions
      WHERE post_slug = ${postSlug}
      GROUP BY type
    `;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.type as string] = row.count as number;
    }
    return result;
  }

  async toggleReaction(postSlug: string, type: string, ipHash: string): Promise<{ action: "added" | "removed" }> {
    // 确保表存在
    await this.client`
      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        post_slug TEXT NOT NULL,
        type TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(post_slug, type, ip_hash)
      )
    `;
    const [existing] = await this.client`
      SELECT id FROM reactions
      WHERE post_slug = ${postSlug} AND type = ${type} AND ip_hash = ${ipHash}
      LIMIT 1
    `;
    if (existing) {
      await this.client`DELETE FROM reactions WHERE id = ${existing.id}`;
      return { action: "removed" };
    }
    await this.client`INSERT INTO reactions (post_slug, type, ip_hash) VALUES (${postSlug}, ${type}, ${ipHash})`;
    return { action: "added" };
  }

  async recordVisit(data: { path: string; country: string; refererDomain: string; deviceType: string }): Promise<void> {
    await this.client`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY, path TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'XX', referer_domain TEXT NOT NULL DEFAULT '',
        device_type TEXT NOT NULL DEFAULT 'desktop',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await this.client`INSERT INTO visits (path, country, referer_domain, device_type) VALUES (${data.path}, ${data.country}, ${data.refererDomain}, ${data.deviceType})`;
  }

  async getAnalytics(days: number) {
    await this.ensureCoreTables();
    await this.client`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY, path TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'XX', referer_domain TEXT NOT NULL DEFAULT '',
        device_type TEXT NOT NULL DEFAULT 'desktop',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    const byDay = await this.client`SELECT DATE(created_at) as date, COUNT(*)::int as count FROM visits WHERE created_at >= NOW() - INTERVAL '1 day' * ${days} GROUP BY DATE(created_at) ORDER BY date`;
    const byCountry = await this.client`SELECT country, COUNT(*)::int as count FROM visits WHERE created_at >= NOW() - INTERVAL '1 day' * ${days} GROUP BY country ORDER BY count DESC LIMIT 10`;
    const byReferer = await this.client`SELECT referer_domain as referer, COUNT(*)::int as count FROM visits WHERE created_at >= NOW() - INTERVAL '1 day' * ${days} AND referer_domain != '' GROUP BY referer_domain ORDER BY count DESC LIMIT 10`;
    const byDevice = await this.client`SELECT device_type as device, COUNT(*)::int as count FROM visits WHERE created_at >= NOW() - INTERVAL '1 day' * ${days} GROUP BY device_type ORDER BY count DESC`;
    const byPage = await this.client`SELECT path, COUNT(*)::int as count FROM visits WHERE created_at >= NOW() - INTERVAL '1 day' * ${days} GROUP BY path ORDER BY count DESC LIMIT 10`;
    return {
      visitsByDay: byDay.map(r => ({ date: r.date as string, count: r.count as number })),
      topCountries: byCountry.map(r => ({ country: r.country as string, count: r.count as number })),
      topReferers: byReferer.map(r => ({ referer: r.referer as string, count: r.count as number })),
      deviceBreakdown: byDevice.map(r => ({ device: r.device as string, count: r.count as number })),
      topPages: byPage.map(r => ({ path: r.path as string, count: r.count as number })),
    };
  }
}
