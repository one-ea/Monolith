-- 0015: 访问控制表
-- 统一存放文章 / 标签 / 分类 / 系列的访问密码哈希。
-- 注意：不在 posts 上加 password_hash 列。SQLite 的 ALTER TABLE ADD COLUMN
-- 不支持 IF NOT EXISTS，裸 ALTER 会在预建库或已 reconcile 的库上重复执行失败；
-- 统一用 content_locks(kind='post', name=slug) 表达单篇锁。

CREATE TABLE IF NOT EXISTS content_locks (
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, name)
);

CREATE INDEX IF NOT EXISTS content_locks_kind_idx ON content_locks(kind);

-- 解锁失败计数：内存 Map 是 per-isolate 的，D1 计数作为跨 isolate 的限流兜底。
CREATE TABLE IF NOT EXISTS unlock_attempts (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS unlock_attempts_window_idx ON unlock_attempts(window_start);
