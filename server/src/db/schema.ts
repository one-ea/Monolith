import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/* ── 文章表 ────────────────────────────────── */
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  excerpt: text("excerpt").default(""),
  coverColor: text("cover_color").default("from-gray-500/20 to-gray-600/20"),
  coverImage: text("cover_image").default(""),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  listed: integer("listed", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  viewCount: integer("view_count").notNull().default(0),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  publishAt: text("publish_at"),
  seriesSlug: text("series_slug"),
  seriesOrder: integer("series_order").notNull().default(0),
  category: text("category").default(""),
});

/* ── 标签表 ────────────────────────────────── */
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

/* ── 文章-标签关联表 ──────────────────────── */
export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] })
  })
);

/* ── 独立页表 ──────────────────────────────── */
export const pages = sqliteTable("pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  showInNav: integer("show_in_nav", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/* ── 评论表 ──────────────────────────────── */
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").notNull().default(""),
  content: text("content").notNull(),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/* ── 表情反应表 ────────────────────────────── */
export const reactions = sqliteTable("reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postSlug: text("post_slug")
    .notNull()
    .references(() => posts.slug, { onDelete: "cascade" }),
  type: text("type").notNull(), // like, heart, celebrate, think
  ipHash: text("ip_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => ({
  uniq: uniqueIndex("reactions_post_type_ip_idx").on(table.postSlug, table.type, table.ipHash)
}));

/* ── 访客记录表 ────────────────────────────── */
export const visits = sqliteTable("visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull(),
  country: text("country").notNull().default("XX"),
  refererDomain: text("referer_domain").notNull().default(""),
  deviceType: text("device_type").notNull().default("desktop"), // desktop, mobile, tablet, bot
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/* ── 文章版本历史表 ────────────────────────── */
export const postVersions = sqliteTable("post_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt").default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
