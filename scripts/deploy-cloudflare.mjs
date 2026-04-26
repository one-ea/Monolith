import { spawnSync } from "node:child_process";
import process from "node:process";

const projectRoot = process.cwd();
const clientRoot = `${projectRoot}/client`;
// Windows 下 npm/npx 实际是 .cmd 脚本，必须 shell:true 才能找到
const IS_WIN = process.platform === "win32";
const SHELL = IS_WIN;

function parseArgs(argv) {
  const options = {
    pagesProject: "monolith-client",
    branch: "main",
    apiBase: process.env.MONOLITH_API_BASE || "",
    skipMigrate: false,
    skipServer: false,
    skipClient: false,
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

    if (arg === "--skip-server") {
      options.skipServer = true;
      continue;
    }

    if (arg === "--skip-client") {
      options.skipClient = true;
    }
  }

  return options;
}

function runStep(title, command, args, extra = {}) {
  console.log(`\n==> ${title}`);
  const result = spawnSync(command, args, {
    cwd: extra.cwd || projectRoot,
    stdio: extra.input ? ["pipe", "inherit", "inherit"] : "inherit",
    input: extra.input,
    encoding: "utf8",
    shell: SHELL,
  });

  if (result.error) {
    console.error(`\n[error] 步骤 "${title}" 启动失败：${result.error.message}`);
    if (result.error.code === "ENOENT") {
      console.error(`[hint] 找不到命令 "${command}"。请确认已安装 Node.js (>=20) 与 npm，并将其加入 PATH。`);
      console.error(`[hint] Windows 用户请通过官网安装包或 nvm-windows 安装；macOS/Linux 推荐用 fnm/nvm。`);
    }
    process.exit(1);
  }

  if (result.status !== 0) {
    const code = result.status === null ? "signal/null" : result.status;
    console.error(`\n[error] 步骤 "${title}" 失败 (exit code ${code})。`);
    if (result.signal) console.error(`[hint] 子进程被信号中断：${result.signal}`);
    process.exit(typeof result.status === "number" ? result.status : 1);
  }
}

function runCapture(title, command, args) {
  console.log(`\n==> ${title}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: SHELL,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    console.error(`\n[error] 步骤 "${title}" 启动失败：${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n[error] 步骤 "${title}" 失败 (exit code ${result.status})。`);
    process.exit(result.status || 1);
  }

  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function checkPrerequisites() {
  const errors = [];
  // wrangler 登录态检测：API_TOKEN 或本机 oauth 二选一
  const tokenPresent = !!process.env.CLOUDFLARE_API_TOKEN;
  if (!tokenPresent) {
    const probe = spawnSync("npx", ["wrangler", "whoami"], {
      cwd: projectRoot,
      encoding: "utf8",
      shell: SHELL,
    });
    if (probe.status !== 0) {
      errors.push(
        "未检测到 CLOUDFLARE_API_TOKEN，且本机 wrangler 未登录。请先 `npx wrangler login`，或导出 CLOUDFLARE_API_TOKEN 后重试。",
      );
    } else {
      console.log("[ok] 已通过本机 wrangler 登录态。");
    }
  } else {
    console.log("[ok] 检测到 CLOUDFLARE_API_TOKEN。");
  }

  if (!process.env.CLOUDFLARE_ACCOUNT_ID && tokenPresent) {
    errors.push(
      "已设置 CLOUDFLARE_API_TOKEN 但未设置 CLOUDFLARE_ACCOUNT_ID。Token 模式下必须显式提供账户 ID。",
    );
  }

  if (errors.length > 0) {
    console.error("\n[预检失败]");
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\n详见 README 「☁️ 部署 → 预检清单」。");
    process.exit(1);
  }
}

function detectWorkersUrl(output) {
  const match = output.match(/https:\/\/[^\s"']+\.workers\.dev/);
  return match ? match[0] : "";
}

function resolvePagesEnv(branch) {
  return branch === "main" ? "production" : "preview";
}

function printPrerequisiteHints() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.warn("[warn] 未检测到 CLOUDFLARE_API_TOKEN，当前依赖本机 wrangler 已登录状态。");
  }
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.warn("[warn] 未检测到 CLOUDFLARE_ACCOUNT_ID，如在 GitHub Actions 中运行请务必配置该变量。");
  }
}

const options = parseArgs(process.argv.slice(2));
printPrerequisiteHints();
checkPrerequisites();

if (!options.skipMigrate) {
  // 绕过 npm workspace shim 直接调 wrangler，避免 Windows 双层 shell 转发吞 stdin
  // 显式 pipe "y\n" 兜底 wrangler "Ok to proceed?" 交互（非 TTY 环境下也能放行）
  runStep(
    "应用远程数据库迁移",
    "npx",
    ["wrangler", "d1", "migrations", "apply", "monolith-db", "--remote"],
    { cwd: `${projectRoot}/server`, input: "y\n" },
  );
}

if (!options.skipServer) {
  if (process.env.ADMIN_PASSWORD) {
    runStep("写入 Backend 的 ADMIN_PASSWORD", "npx", [
      "wrangler", "secret", "put", "ADMIN_PASSWORD", "--name", "monolith-server"
    ], { input: `${process.env.ADMIN_PASSWORD}\n`, cwd: `${projectRoot}/server` });
  }
  if (process.env.JWT_SECRET) {
    runStep("写入 Backend 的 JWT_SECRET", "npx", [
      "wrangler", "secret", "put", "JWT_SECRET", "--name", "monolith-server"
    ], { input: `${process.env.JWT_SECRET}\n`, cwd: `${projectRoot}/server` });
  }

  const deployOutput = runCapture("部署 Cloudflare Workers 后端", "npm", ["run", "deploy:server"]);
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

  runStep(
    "写入 Cloudflare Pages 的 API_BASE",
    "npx",
    ["wrangler", "pages", "secret", "put", "API_BASE", "--project-name", options.pagesProject, "--env", pagesEnv],
    { input: `${options.apiBase}\n` }
  );

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

console.log("\n部署流程完成。");
if (options.apiBase) {
  console.log(`Pages Functions 当前指向的后端：${options.apiBase}`);
}
console.log("建议立即访问 /api/health 与 /admin，确认文章保存、页面创建和媒体上传均正常。");
