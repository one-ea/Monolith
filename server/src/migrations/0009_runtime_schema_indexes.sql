-- 0009: 为运行时补齐表增加常用查询索引

CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments(post_id);
CREATE INDEX IF NOT EXISTS visits_path_idx ON visits(path);
