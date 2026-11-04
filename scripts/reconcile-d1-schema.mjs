import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { runWrangler as runWranglerCli } from "./lib/wrangler-cli.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = resolve(projectRoot, "server");

function parseArgs(argv) {
  const options = {
    mode: "local",
    database: "monolith-db",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--remote") {
      options.mode = "remote";
      continue;
    }

    if (arg === "--local") {
      options.mode = "local";
      continue;
    }

    if (arg === "--database") {
      options.database = argv[i + 1] || options.database;
      i += 1;
    }
  }

  return options;
}

function runWrangler(args, title) {
  let result;
  try {
    result = runWranglerCli(args, { cwd: serverRoot, stdio: "pipe" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`\n[error] ${title} 失败：${detail}`);
    process.exit(1);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function d1Scope(mode) {
  return mode === "remote" ? "--remote" : "--local";
}

function queryPostsColumns(options) {
  const output = runWrangler(
    [
      "d1",
      "execute",
      options.database,
      d1Scope(options.mode),
      "--yes",
      "--json",
      "--command",
      "SELECT name FROM pragma_table_info('posts');",
    ],
    "读取 posts 表结构",
  );

  try {
    const start = output.indexOf("[");
    const end = output.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) throw new Error("wrangler 未返回 JSON 数组");
    const parsed = JSON.parse(output.slice(start, end + 1));
    const rows = parsed?.[0]?.results ?? [];
    return new Set(rows.map((row) => row.name).filter(Boolean));
  } catch {
    return new Set(output.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []);
  }
}

function addColumn(options, column) {
  runWrangler(
    [
      "d1",
      "execute",
      options.database,
      d1Scope(options.mode),
      "--yes",
      "--command",
      `ALTER TABLE posts ADD COLUMN ${column.sql};`,
    ],
    `补全 posts.${column.name}`,
  );
}

const POST_COLUMNS = [
  { name: "view_count", sql: "view_count INTEGER NOT NULL DEFAULT 0" },
  { name: "pinned", sql: "pinned INTEGER NOT NULL DEFAULT 0" },
  { name: "publish_at", sql: "publish_at TEXT" },
  { name: "cover_image", sql: "cover_image TEXT DEFAULT ''" },
  { name: "series_slug", sql: "series_slug TEXT" },
  { name: "series_order", sql: "series_order INTEGER NOT NULL DEFAULT 0" },
  { name: "category", sql: "category TEXT DEFAULT ''" },
  { name: "card_width", sql: "card_width INTEGER NOT NULL DEFAULT 100" },
  { name: "card_height", sql: "card_height INTEGER NOT NULL DEFAULT 220" },
];

const options = parseArgs(process.argv.slice(2));
console.log(`[info] D1 schema reconcile: ${options.database} (${options.mode})`);

const columns = queryPostsColumns(options);
if (columns.size === 0) {
  console.log("[skip] posts 表不存在，请先执行数据库迁移。");
  process.exit(0);
}

const missing = POST_COLUMNS.filter((column) => !columns.has(column.name));

if (missing.length === 0) {
  console.log("[ok] posts 表列已完整，无需补全。");
  process.exit(0);
}

for (const column of missing) {
  addColumn(options, column);
}

// 访问控制表：0013 迁移会创建；这里再跑一次幂等 DDL，
// 保证 --skip-migrate 的部署或旧库也能拿到表。
runWrangler(
  [
    "d1",
    "execute",
    options.database,
    d1Scope(options.mode),
    "--yes",
    "--command",
    `CREATE TABLE IF NOT EXISTS content_locks (
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (kind, name)
    );
    CREATE INDEX IF NOT EXISTS content_locks_kind_idx ON content_locks(kind);
    CREATE TABLE IF NOT EXISTS unlock_attempts (
      key TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (key, window_start)
    );
    CREATE INDEX IF NOT EXISTS unlock_attempts_window_idx ON unlock_attempts(window_start);`,
  ],
  "补齐访问控制表"
);

console.log(`[ok] 已补全 posts 表列：${missing.length > 0 ? missing.map((column) => column.name).join(", ") : "无"}`);
