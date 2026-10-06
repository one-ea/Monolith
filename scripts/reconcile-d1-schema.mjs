import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = resolve(projectRoot, "server");
const IS_WIN = process.platform === "win32";
const SHELL = IS_WIN;

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
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: serverRoot,
    encoding: "utf8",
    shell: SHELL,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error || result.status !== 0) {
    const detail = result.error ? result.error.message : `exit code ${result.status}`;
    console.error(`\n[error] ${title} 失败：${detail}`);
    process.exit(typeof result.status === "number" ? result.status : 1);
  }

  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function d1Scope(mode) {
  return mode === "remote" ? "--remote" : "--local";
}

function queryTableColumns(options, table) {
  const output = runWrangler(
    [
      "d1",
      "execute",
      options.database,
      d1Scope(options.mode),
      "--json",
      "--command",
      `SELECT name FROM pragma_table_info('${table}');`,
    ],
    `读取 ${table} 表结构`,
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

function addColumn(options, table, column) {
  runWrangler(
    [
      "d1",
      "execute",
      options.database,
      d1Scope(options.mode),
      "--command",
      `ALTER TABLE ${table} ADD COLUMN ${column.sql};`,
    ],
    `补全 ${table}.${column.name}`,
  );
}

/* 各表的历史兼容列（与 server/src/migrations 及适配器 ensure*Table 保持一致） */
const RECONCILE_COLUMNS = {
  posts: [
    { name: "view_count", sql: "view_count INTEGER NOT NULL DEFAULT 0" },
    { name: "pinned", sql: "pinned INTEGER NOT NULL DEFAULT 0" },
    { name: "publish_at", sql: "publish_at TEXT" },
    { name: "cover_image", sql: "cover_image TEXT DEFAULT ''" },
    { name: "series_slug", sql: "series_slug TEXT" },
    { name: "series_order", sql: "series_order INTEGER NOT NULL DEFAULT 0" },
    { name: "category", sql: "category TEXT DEFAULT ''" },
    { name: "card_width", sql: "card_width INTEGER NOT NULL DEFAULT 100" },
    { name: "card_height", sql: "card_height INTEGER NOT NULL DEFAULT 220" },
  ],
  comments: [
    { name: "parent_id", sql: "parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE" },
    { name: "is_admin", sql: "is_admin INTEGER NOT NULL DEFAULT 0" },
  ],
};

const options = parseArgs(process.argv.slice(2));
console.log(`[info] D1 schema reconcile: ${options.database} (${options.mode})`);

let repaired = [];

for (const [table, columns] of Object.entries(RECONCILE_COLUMNS)) {
  const existing = queryTableColumns(options, table);

  if (existing.size === 0 && table !== "posts") {
    console.log(`[warn] ${table} 表不存在，跳过补列（请先运行 npm run db:migrate:local 或远程迁移）。`);
    continue;
  }

  const missing = columns.filter((column) => !existing.has(column.name));
  if (missing.length === 0) {
    console.log(`[ok] ${table} 表列已完整，无需补全。`);
    continue;
  }

  for (const column of missing) {
    addColumn(options, table, column);
  }
  console.log(`[ok] 已补全 ${table} 表列：${missing.map((column) => column.name).join(", ")}`);
  repaired.push(...missing.map((column) => `${table}.${column.name}`));
}

if (repaired.length === 0) {
  console.log("[ok] 所有表列已完整。");
}
