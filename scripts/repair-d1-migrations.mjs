import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { parseWranglerJson, runWrangler } from "./lib/wrangler-cli.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = resolve(projectRoot, "server");
const migrationsDir = resolve(serverRoot, "src", "migrations");

function parseArgs(argv) {
  const options = {
    mode: "local",
    database: "monolith-db",
    dryRun: false,
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
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const scope = options.mode === "remote" ? "--remote" : "--local";

function execute(sql, { json = true } = {}) {
  const args = [
    "d1",
    "execute",
    options.database,
    scope,
    "--yes",
    ...(json ? ["--json"] : []),
    "--command",
    sql,
  ];
  const result = runWrangler(args, { cwd: serverRoot, stdio: "pipe" });
  if (!json) return result;

  const parsed = parseWranglerJson(`${result.stdout || ""}\n${result.stderr || ""}`);
  if (!parsed) {
    throw new Error(`wrangler 未返回可解析的 JSON：${sql}`);
  }
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  const first = entries.find((entry) => entry && Array.isArray(entry.results)) || entries[0];
  return Array.isArray(first?.results) ? first.results : [];
}

function quoteSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseAlterColumns(sql) {
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
  const statements = cleaned.split(";").map((statement) => statement.trim()).filter(Boolean);
  if (statements.length === 0) return null;

  const columns = [];
  for (const statement of statements) {
    const match = statement.match(
      /^ALTER\s+TABLE\s+posts\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\b/i
    );
    if (!match) return null;
    columns.push(match[1]);
  }
  return columns;
}

const tables = new Set(
  execute("SELECT name FROM sqlite_master WHERE type = 'table';").map((row) => row.name)
);

if (!tables.has("posts")) {
  console.log("[skip] posts 表不存在，交给 wrangler 从 0001 开始正常迁移。");
  process.exit(0);
}

const postColumns = new Set(
  execute("SELECT name FROM pragma_table_info('posts');").map((row) => row.name)
);

let applied = new Set();
if (tables.has("d1_migrations")) {
  applied = new Set(
    execute("SELECT name FROM d1_migrations;").map((row) => row.name)
  );
}

const files = readdirSync(migrationsDir)
  .filter((file) => /^[0-9]{4}_[A-Za-z0-9_-]+\.sql$/.test(file))
  .sort();

if (files.length === 0) {
  console.log("[skip] 未找到迁移文件。");
  process.exit(0);
}

const toStamp = [];

for (const file of files) {
  if (applied.has(file)) continue;

  const sql = readFileSync(resolve(migrationsDir, file), "utf8");

  // 0002 是种子数据：预建库里已经有文章时，不应再重放硬编码的 post_id/tag_id 关联。
  if (file === "0002_seed.sql") {
    const rows = execute("SELECT COUNT(*) AS count FROM posts;");
    if (Number(rows[0]?.count ?? 0) > 0) {
      toStamp.push({ file, reason: "posts 已有数据，跳过种子重放" });
    }
    continue;
  }

  const alterColumns = parseAlterColumns(sql);
  if (!alterColumns) continue;

  const missing = alterColumns.filter((column) => !postColumns.has(column));
  if (missing.length === 0) {
    toStamp.push({
      file,
      reason: `目标列已存在：${alterColumns.join(", ")}`,
    });
  } else {
    console.log(
      `[skip] ${file}: 目标列尚未齐全（缺 ${missing.join(", ")}），保留给 migrations apply / reconcile 处理。`
    );
  }
}

if (toStamp.length === 0) {
  console.log("[ok] 没有需要补记的迁移记录。");
  process.exit(0);
}

console.log(
  `[info] D1 迁移补记：${options.database} (${options.mode})${options.dryRun ? " [dry-run]" : ""}`
);
for (const item of toStamp) {
  console.log(`  + ${item.file} — ${item.reason}`);
}

if (options.dryRun) {
  process.exit(0);
}

if (!tables.has("d1_migrations")) {
  execute(
    `CREATE TABLE IF NOT EXISTS d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,
    { json: false }
  );
}

for (const item of toStamp) {
  execute(
    `INSERT OR IGNORE INTO d1_migrations (name) VALUES (${quoteSqlString(item.file)});`,
    { json: false }
  );
}

console.log(`[ok] 已补记 ${toStamp.length} 条迁移记录。`);
