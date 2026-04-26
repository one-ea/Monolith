import { spawnSync } from "node:child_process";
import process from "node:process";

const projectRoot = process.cwd();
const clientRoot = `${projectRoot}/client`;

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
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function runCapture(title, command, args) {
  console.log(`\n==> ${title}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  return `${result.stdout || ""}\n${result.stderr || ""}`;
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

if (!options.skipMigrate) {
  runStep("应用远程数据库迁移", "npm", ["run", "db:migrate:remote"]);
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
