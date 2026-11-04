import { spawnSync } from "node:child_process";
import process from "node:process";
import { parseWranglerJson, resolveWranglerCli } from "./lib/wrangler-cli.mjs";

const projectRoot = process.cwd();
const clientRoot = `${projectRoot}/client`;
const ACCOUNT_ID_RE = /^[0-9a-f]{32}$/i;
// Windows 下 npm/npx 实际是 .cmd 脚本，必须 shell:true 才能找到
const IS_WIN = process.platform === "win32";
const SHELL = IS_WIN;

let resolvedAccountId = "";
let cachedIdentity = null;

function parseArgs(argv) {
  const options = {
    pagesProject: "monolith-client",
    branch: "main",
    apiBase: process.env.MONOLITH_API_BASE || "",
    skipMigrate: false,
    skipReconcile: false,
    skipServer: false,
    skipClient: false,
    skipPurge: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--pages-project") {
      options.pagesProject = argv[i + 1] || options.pagesProject;
      i += 1;
      continue;
    }

    if (arg === "--branch") {
      options.branch = argv[i + 1] || options.branch;
      i += 1;
      continue;
    }

    if (arg === "--api-base") {
      options.apiBase = argv[i + 1] || options.apiBase;
      i += 1;
      continue;
    }

    if (arg === "--skip-migrate") {
      options.skipMigrate = true;
      continue;
    }

    if (arg === "--skip-reconcile") {
      options.skipReconcile = true;
      continue;
    }

    if (arg === "--skip-server") {
      options.skipServer = true;
      continue;
    }

    if (arg === "--skip-client") {
      options.skipClient = true;
    }

    if (arg === "--skip-purge") {
      options.skipPurge = true;
    }
  }

  return options;
}

function runResult(command, args, extra = {}) {
  return spawnSync(command, args, {
    cwd: extra.cwd || projectRoot,
    env: {
      ...process.env,
      ...(resolvedAccountId ? { CLOUDFLARE_ACCOUNT_ID: resolvedAccountId } : {}),
    },
    stdio: extra.stdio || (extra.input ? ["pipe", "inherit", "inherit"] : "inherit"),
    input: extra.input,
    encoding: "utf8",
    shell: SHELL,
  });
}

function failHard(message) {
  console.error(`\n[error] ${message}`);
  process.exit(1);
}

function probeWranglerIdentity() {
  if (cachedIdentity) return cachedIdentity;

  const cli = resolveWranglerCli();
  if (!cli) {
    cachedIdentity = { ok: false, message: "找不到本地 wrangler，请先执行 npm ci" };
    return cachedIdentity;
  }

  const env = { ...process.env };
  delete env.CLOUDFLARE_ACCOUNT_ID;

  const result = spawnSync(process.execPath, [cli, "whoami", "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
    env,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();

  if (result.error) {
    cachedIdentity = { ok: false, message: result.error.message };
    return cachedIdentity;
  }
  if (result.status !== 0) {
    cachedIdentity = { ok: false, message: output || `wrangler whoami 退出码 ${result.status}` };
    return cachedIdentity;
  }

  const payload = parseWranglerJson(output);
  if (!payload?.loggedIn) {
    cachedIdentity = { ok: false, message: "wrangler 未登录" };
    return cachedIdentity;
  }

  cachedIdentity = {
    ok: true,
    accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
  };
  return cachedIdentity;
}

function resolveCloudflareAccountId() {
  if (resolvedAccountId) return resolvedAccountId;

  const fromEnv = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (fromEnv) {
    if (!ACCOUNT_ID_RE.test(fromEnv)) {
      failHard(
        `CLOUDFLARE_ACCOUNT_ID 格式无效：需要 32 位十六进制 Account ID，当前长度为 ${fromEnv.length}。`
      );
    }
    resolvedAccountId = fromEnv.toLowerCase();
    return resolvedAccountId;
  }

  const identity = probeWranglerIdentity();
  if (!identity.ok) {
    failHard(
      `无法自动确定 Cloudflare Account ID：${identity.message}。\n` +
        "  请设置 CLOUDFLARE_ACCOUNT_ID，或先运行 npx wrangler login 后重试。"
    );
  }

  if (identity.accounts.length === 0) {
    failHard(
      "wrangler 已登录，但无法列出账户（API Token 可能缺少 Account Settings:Read 权限）。\n" +
        "  请显式设置 CLOUDFLARE_ACCOUNT_ID 后重试。"
    );
  }

  if (identity.accounts.length > 1) {
    const names = identity.accounts
      .map((account) => `  - ${String(account?.name || "(未命名账户)")}`)
      .join("\n");
    failHard(
      "wrangler 登录态下有多个 Cloudflare 账户，无法自动选择。\n" +
        `  请设置 CLOUDFLARE_ACCOUNT_ID 后重试。可用账户：\n${names}`
    );
  }

  const account = identity.accounts[0];
  const id = String(account?.id || "").trim();
  if (!ACCOUNT_ID_RE.test(id)) {
    failHard("wrangler 返回的 Account ID 格式无效，请显式设置 CLOUDFLARE_ACCOUNT_ID。");
  }

  resolvedAccountId = id.toLowerCase();
  console.log(`[ok] 已从 wrangler 登录态识别账户：${account?.name || "(未命名)"}`);
  return resolvedAccountId;
}

function printWranglerHints(result) {
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (/10089|no_access_to_analytics_engine/i.test(output)) {
    console.error(
      "\n[hint] Cloudflare 报 code 10089（Analytics Engine 未开通/无权限）。\n" +
        "  处理方式二选一：\n" +
        "  1. 在 Cloudflare Dashboard 启用 Analytics Engine（Workers & Pages → Analytics Engine）；\n" +
        "  2. 不使用 AE 时，注释 server/wrangler.toml 的 [[analytics_engine_datasets]] 段后重试。"
    );
  }
}

function failStep(title, command, result) {
  if (result.error) {
    console.error(`\n[error] 步骤 "${title}" 启动失败：${result.error.message}`);
    if (result.error.code === "ENOENT") {
      console.error(`[hint] 找不到命令 "${command}"。请确认已安装 Node.js (>=22) 与 npm，并将其加入 PATH。`);
      console.error(`[hint] Windows 用户请通过官网安装包或 nvm-windows 安装；macOS/Linux 推荐用 fnm/nvm。`);
    }
    process.exit(1);
  }

  const code = result.status === null ? "signal/null" : result.status;
  console.error(`\n[error] 步骤 "${title}" 失败 (exit code ${code})。`);
  if (result.signal) console.error(`[hint] 子进程被信号中断：${result.signal}`);
  printWranglerHints(result);
  process.exit(typeof result.status === "number" ? result.status : 1);
}

function runStep(title, command, args, extra = {}) {
  console.log(`\n==> ${title}`);
  const result = runResult(command, args, extra);

  if (result.error || result.status !== 0) {
    failStep(title, command, result);
  }
}

function runCapture(title, command, args, extra = {}) {
  console.log(`\n==> ${title}`);
  const result = runResult(command, args, { ...extra, stdio: "pipe" });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error || result.status !== 0) {
    failStep(title, command, result);
  }

  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function checkPrerequisites(options) {
  const errors = [];
  // wrangler 登录态检测：API_TOKEN 或本机 oauth 二选一
  const tokenPresent = !!process.env.CLOUDFLARE_API_TOKEN;
  if (!tokenPresent) {
    const identity = probeWranglerIdentity();
    if (!identity.ok) {
      errors.push(
        "未检测到 CLOUDFLARE_API_TOKEN，且本机 wrangler 未登录。请先 `npx wrangler login`，或导出 CLOUDFLARE_API_TOKEN 后重试。"
      );
    } else {
      console.log("[ok] 已通过本机 wrangler 登录态。");
    }
  } else {
    console.log("[ok] 检测到 CLOUDFLARE_API_TOKEN。");
  }

  if (!errors.length && !process.env.CLOUDFLARE_ACCOUNT_ID) {
    const identity = probeWranglerIdentity();
    if (identity.ok && identity.accounts.length === 0) {
      errors.push(
        "已登录但无法列出 Cloudflare 账户。请在 CLOUDFLARE_API_TOKEN 模式下显式设置 CLOUDFLARE_ACCOUNT_ID。"
      );
    }
  }

  if (!options.skipServer && !process.env.ADMIN_PASSWORD) {
    errors.push(
      "未设置 ADMIN_PASSWORD。请先在当前 shell 中设置后台登录密码，例如：`export ADMIN_PASSWORD='换成强密码'`。",
    );
  }

  if (!options.skipServer && !process.env.JWT_SECRET) {
    errors.push(
      "未设置 JWT_SECRET。请先生成并设置 JWT 签名密钥，例如：`export JWT_SECRET=\"$(openssl rand -base64 32)\"`。",
    );
  }

  if (errors.length > 0) {
    console.error("\n[预检失败]");
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\n详见 README 「☁️ 部署 → 预检清单」。");
    process.exit(1);
  }

  // Windows 环境卫生提示（非阻断，仅警告）
  if (IS_WIN) {
    const autocrlfProbe = spawnSync("git", ["config", "--get", "core.autocrlf"], {
      cwd: projectRoot,
      encoding: "utf8",
      shell: SHELL,
    });
    const autocrlf = (autocrlfProbe.stdout || "").trim();
    if (autocrlf === "true") {
      console.warn(
        "[warn] git core.autocrlf=true 检测到——可能把 wrangler.toml/*.mjs 改成 CRLF，wrangler 解析 toml 偶发报错。",
      );
      console.warn("[hint] 建议执行：git config --global core.autocrlf input 后重新 clone 仓库。");
    }
    // 覆盖个人版 (OneDrive)、企业版 (OneDrive - Contoso)、历史变体 (OneDriveCommercial / OneDrive-Personal)
    // 必须以路径分隔符或路径根开始，紧跟 onedrive，后接空格/连字符/分隔符/词尾，或紧跟字母（Commercial 等）
    const oneDrivePattern = /(?:^|[\\/])onedrive(?:[\s\-\\/]|[A-Za-z]|$)/i;
    if (oneDrivePattern.test(projectRoot)) {
      console.warn(
        "[warn] 仓库位于 OneDrive 同步目录——OneDrive 实时同步会与 Node fs.watch 抢锁，构建偶发卡死。",
      );
      console.warn("[hint] 建议把仓库迁移到 C:\\dev\\Monolith 等独立本地目录后重试。");
    }
  }
}

function detectWorkersUrl(output) {
  const match = output.match(/https:\/\/[^\s"']+\.workers\.dev/);
  return match ? match[0] : "";
}

function resolvePagesEnv(branch) {
  return branch === "main" ? "production" : "preview";
}

function ensurePagesProject(projectName, branch) {
  console.log(`[info] 未发现 Pages 项目 "${projectName}"，将自动创建（生产分支：${branch}）。`);
  runStep(
    `创建 Cloudflare Pages 项目 "${projectName}"`,
    "npx",
    [
      "wrangler",
      "pages",
      "project",
      "create",
      projectName,
      "--production-branch",
      branch,
    ],
  );
}

function shouldCreatePagesProject(result) {
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  return output.includes("not found") || output.includes("does not exist") || output.includes("404");
}

function printResultOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function printPrerequisiteHints() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.warn("[warn] 未检测到 CLOUDFLARE_API_TOKEN，当前依赖本机 wrangler 已登录状态。");
  }
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.log("[info] 未设置 CLOUDFLARE_ACCOUNT_ID，将从 wrangler 登录态自动识别；多账户时需显式指定。");
  }
}

const options = parseArgs(process.argv.slice(2));
printPrerequisiteHints();
checkPrerequisites(options);
resolveCloudflareAccountId();

if (options.skipReconcile && !options.skipMigrate) {
  console.warn(
    "[warn] 已启用 --skip-reconcile：若目标库存在“列已存在但迁移未记录”的情况，migrations apply 仍可能报 duplicate column。"
  );
}

if (!options.skipReconcile) {
  runStep("补齐远程 D1 schema 兼容列", "node", [
    "scripts/reconcile-d1-schema.mjs",
    "--remote",
  ]);
}

if (!options.skipMigrate) {
  // 预建库可能执行过 SQL 但没有写入 d1_migrations；先按结构补记，
  // 避免 0003 之类的 ALTER 因重复列中止整条迁移链。
  runStep("检查并修复 D1 迁移记录", "node", [
    "scripts/repair-d1-migrations.mjs",
    "--remote",
  ]);
  // 绕过 npm workspace shim 直接调 wrangler，避免 Windows 双层 shell 转发吞 stdin
  // 显式 pipe "y\n" 兜底 wrangler "Ok to proceed?" 交互（非 TTY 环境下也能放行）
  runStep(
    "应用远程数据库迁移",
    "npx",
    ["wrangler", "d1", "migrations", "apply", "monolith-db", "--remote"],
    { cwd: `${projectRoot}/server`, input: "y\n" },
  );
  if (!options.skipReconcile) {
    runStep("复核远程 D1 schema 兼容列", "node", [
      "scripts/reconcile-d1-schema.mjs",
      "--remote",
    ]);
  }
}

if (!options.skipServer) {
  runStep("写入 Backend 的 ADMIN_PASSWORD", "npx", [
    "wrangler", "secret", "put", "ADMIN_PASSWORD", "--name", "monolith-server"
  ], { input: `${process.env.ADMIN_PASSWORD}\n`, cwd: `${projectRoot}/server` });

  runStep("写入 Backend 的 JWT_SECRET", "npx", [
    "wrangler", "secret", "put", "JWT_SECRET", "--name", "monolith-server"
  ], { input: `${process.env.JWT_SECRET}\n`, cwd: `${projectRoot}/server` });

  const deployOutput = runCapture(
    "部署 Cloudflare Workers 后端",
    "npx",
    ["wrangler", "deploy", "--var", `CLOUDFLARE_ACCOUNT_ID:${resolvedAccountId}`],
    { cwd: `${projectRoot}/server` },
  );
  if (!options.apiBase) {
    options.apiBase = detectWorkersUrl(deployOutput);
  }
}

if (!options.skipClient) {
  if (!options.apiBase) {
    console.error("\n部署已中止：未能自动识别 Workers URL。请追加 --api-base https://your-worker.workers.dev 后重试。");
    process.exit(1);
  }

  const pagesEnv = resolvePagesEnv(options.branch);

  const pagesSecretArgs = [
    "wrangler",
    "pages",
    "secret",
    "put",
    "API_BASE",
    "--project-name",
    options.pagesProject,
    "--env",
    pagesEnv,
  ];
  console.log(`\n==> 写入 Cloudflare Pages 的 API_BASE`);
  let pagesSecret = runResult("npx", pagesSecretArgs, { input: `${options.apiBase}\n`, stdio: "pipe" });
  printResultOutput(pagesSecret);

  if (pagesSecret.error || pagesSecret.status !== 0) {
    if (!shouldCreatePagesProject(pagesSecret)) {
      failStep("写入 Cloudflare Pages 的 API_BASE", "npx", pagesSecret);
    }
    console.warn("[warn] Pages 项目不存在，创建后重试 API_BASE 写入。");
    ensurePagesProject(options.pagesProject, options.branch);
    console.log(`\n==> 重试写入 Cloudflare Pages 的 API_BASE`);
    pagesSecret = runResult("npx", pagesSecretArgs, { input: `${options.apiBase}\n`, stdio: "pipe" });
    printResultOutput(pagesSecret);
  }

  if (pagesSecret.error || pagesSecret.status !== 0) {
    failStep("写入 Cloudflare Pages 的 API_BASE", "npx", pagesSecret);
  }

  runStep("构建前端", "npm", ["run", "build"]);
  runStep("部署 Cloudflare Pages 前端", "npx", [
    "wrangler",
    "pages",
    "deploy",
    "dist",
    "--project-name",
    options.pagesProject,
    "--branch",
    options.branch,
    "--commit-dirty=true",
    "--commit-message",
    "monolith deploy",
  ], { cwd: clientRoot });
}

// 部署后清除 Cloudflare 区域缓存（best-effort：失败只警告，不影响部署结果）
// 自定义域名（zone）场景下 sitemap/robots/API 带 max-age 缓存，不清除会有最长 1 小时的旧内容窗口；
// 仅使用 *.pages.dev / *.workers.dev 时没有独立 zone，直接跳过即可
async function purgeZoneCache(options) {
  if (options.skipPurge) {
    console.log("\n[skip] 已按 --skip-purge 跳过缓存清除。");
    return;
  }
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!zoneId) {
    console.log("\n[skip] 未设置 CLOUDFLARE_ZONE_ID，跳过缓存清除（*.pages.dev 无独立 zone，无需清除）。");
    return;
  }
  if (!token) {
    console.warn("\n[warn] 已设置 CLOUDFLARE_ZONE_ID，但缺少 CLOUDFLARE_API_TOKEN（本机 wrangler 登录态不能用于 API 直调），跳过缓存清除。");
    return;
  }

  console.log("\n==> 清除 Cloudflare 区域缓存");
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ purge_everything: true }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      const errors = (data?.errors || []).map((e) => e.message).join("; ");
      console.warn(`[warn] 缓存清除失败（HTTP ${res.status}${errors ? `：${errors}` : ""}）。请确认 token 具备 Zone.Cache Purge 权限且 zone ID 正确；部署本身已成功。`);
      return;
    }
    console.log("[ok] Cloudflare 区域缓存已清除（purge_everything）。");
  } catch (err) {
    console.warn(`[warn] 缓存清除请求异常：${err instanceof Error ? err.message : err}。部署本身已成功。`);
  }
}

await purgeZoneCache(options);

console.log("\n部署流程完成。");
if (options.apiBase) {
  console.log(`Pages Functions 当前指向的后端：${options.apiBase}`);
}
console.log("建议立即访问 /api/health 与 /admin，确认文章保存、页面创建和媒体上传均正常。");
