-- 文章封面缩略图字段
-- 用于在文章列表卡片左侧显示缩略图（用户反馈 #13）
-- D1 / Turso 通用 SQL，PostgreSQL 通过 ensureCoreTables 内的 ALTER 兜底
ALTER TABLE posts ADD COLUMN cover_image TEXT DEFAULT '';
