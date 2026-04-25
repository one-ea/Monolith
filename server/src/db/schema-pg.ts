/* ──────────────────────────────────────────────
   PostgreSQL 版 Drizzle Schema
   与 SQLite 版 (db/schema.ts) 功能完全一致
   但使用 PostgreSQL 方言（serial, timestamp 等）
   ────────────────────────────────────────────── */

import { pgTable, serial, text, boolean, integer, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

/* ── 文章表 ────────────────────────────────── */
export const pgPosts = pgTable("posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  excerpt: text("excerpt").default(""),
  coverColor: text("cover_color").default("from-gray-500/20 to-gray-600/20"),
  coverImage: text("cover_image").default(""),
  published: boolean("published").notNull().default(true),
  listed: boolean("listed").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  viewCount: integer("view_count").notNull().default(0),
  pinned: boolean("pinned").notNull().default(false),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  seriesSlug: text("series_slug"),
  seriesOrder: integer("series_order").notNull().default(0),
  category: text("category").default(""),
});

/* ── 标签表 ────────────────────────────────── */
export const pgTags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

/* ── 文章-标签关联表 ──────────────────────── */
export const pgPostTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => pgPosts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => pgTags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] }),
  })
);

/* ── 独立页表 ──────────────────────────────── */
export const pgPages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  showInNav: boolean("show_in_nav").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── 设置表 ────────────────────────────────── */
export const pgSettings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* ── 评论表 ──────────────────────────────── */
export const pgComments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => pgPosts.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").notNull().default(""),
  content: text("content").notNull(),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── 表情反应表 ────────────────────────────── */
export const pgReactions = pgTable("reactions", {
  id: serial("id").primaryKey(),
  postSlug: text("post_slug")
    .notNull()
    .references(() => pgPosts.slug, { onDelete: "cascade" }),
  type: text("type").notNull(),
  ipHash: text("ip_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniq: uniqueIndex("pg_reactions_post_type_ip_idx").on(table.postSlug, table.type, table.ipHash)
}));

/* ── 访客记录表 ────────────────────────────── */
export const pgVisits = pgTable("visits", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  country: text("country").notNull().default("XX"),
  refererDomain: text("referer_domain").notNull().default(""),
  deviceType: text("device_type").notNull().default("desktop"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── 文章版本历史表 ────────────────────────── */
export const pgPostVersions = pgTable("post_versions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => pgPosts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt").default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
