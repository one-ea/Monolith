import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = resolve(projectRoot, "server");

function resolveWranglerCli() {
  const requireFromServer = createRequire(resolve(serverRoot, "package.json"));
  const packageJsonPath = requireFromServer.resolve("wrangler/package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const bin = typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin?.wrangler || packageJson.bin?.["cf-wrangler"];

  if (!bin) throw new Error("依赖 wrangler 未声明 CLI 入口");
  return resolve(dirname(packageJsonPath), bin);
}

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
  const result = spawnSync(process.execPath, [resolveWranglerCli(), ...args], {
    cwd: serverRoot,
    encoding: "utf8",
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

function queryPostsColumns(options) {
  const output = runWrangler(
    [
      "d1",
      "execute",
      options.database,
      d1Scope(options.mode),
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
      "--command",
      `ALTER TABLE posts ADD COLUMN ${column.sql};`,
    ],
    `补全 posts.${column.name}`,
  );
}

const POST_COLUMNS = [
  { name: "series_slug", sql: "series_slug TEXT" },
  { name: "series_order", sql: "series_order INTEGER NOT NULL DEFAULT 0" },
  { name: "category", sql: "category TEXT DEFAULT ''" },
  { name: "card_width", sql: "card_width INTEGER NOT NULL DEFAULT 100" },
  { name: "card_height", sql: "card_height INTEGER NOT NULL DEFAULT 220" },
];

const options = parseArgs(process.argv.slice(2));
console.log(`[info] D1 schema reconcile: ${options.database} (${options.mode})`);

const columns = queryPostsColumns(options);
const missing = POST_COLUMNS.filter((column) => !columns.has(column.name));

if (missing.length === 0) {
  console.log("[ok] posts 表列已完整，无需补全。");
  process.exit(0);
}

for (const column of missing) {
  addColumn(options, column);
}

console.log(`[ok] 已补全 posts 表列：${missing.map((column) => column.name).join(", ")}`);
