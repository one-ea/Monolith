import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import process from "node:process";

const requiredBins = ["node", "npm"];
const optionalBins = ["rg", "gh", "sqlite3", "psql", "turso"];
const workspaceBins = ["tsc", "eslint", "vite", "wrangler"];
const devVarsPath = "server/.dev.vars";

function run(command, args = []) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

function commandOutput(command, args = []) {
  const result = run(command, args);
  return result.status === 0 ? (result.stdout || result.stderr || "").trim() : "";
}

function hasCommand(command) {
  const probe = process.platform === "win32"
    ? run("where", [command])
    : run("which", [command]);
  return probe.status === 0;
}

function checkBinFile(name) {
  const path = `node_modules/.bin/${name}`;
  if (!existsSync(path)) return { name, status: "missing", detail: path };

  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return { name, status: "ok", detail: "symlink" };
  if (stat.size === 0) return { name, status: "broken", detail: "0-byte shim" };
  if (stat.mode & 0o111) return { name, status: "ok", detail: "executable" };
  return { name, status: "broken", detail: "not executable" };
}

function readNvmrc() {
  return existsSync(".nvmrc") ? readFileSync(".nvmrc", "utf8").trim() : "";
}

function hasDevVar(name) {
  if (!existsSync(devVarsPath)) return false;
  const content = readFileSync(devVarsPath, "utf8");
  return new RegExp(`^${name}=.+`, "m").test(content);
}

const problems = [];
const warnings = [];

for (const bin of requiredBins) {
  if (!hasCommand(bin)) problems.push(`缺少必需命令: ${bin}`);
}

const nodeVersion = commandOutput("node", ["--version"]);
const npmVersion = commandOutput("npm", ["--version"]);
const nvmrc = readNvmrc();

if (nodeVersion && nvmrc && !nodeVersion.startsWith(`v${nvmrc}.`)) {
  warnings.push(`当前 Node ${nodeVersion} 与 .nvmrc (${nvmrc}) 不一致，建议执行 nvm use`);
}

if (!existsSync("node_modules")) {
  problems.push("缺少 node_modules，请执行 npm ci");
} else {
  for (const bin of workspaceBins) {
    const result = checkBinFile(bin);
    if (result.status === "missing") problems.push(`缺少本地 CLI: ${result.detail}`);
    if (result.status === "broken") problems.push(`本地 CLI 异常: ${result.name} (${result.detail})，请执行 npm ci`);
  }
}

if (!existsSync(devVarsPath)) {
  problems.push(`缺少 ${devVarsPath}`);
} else {
  for (const key of ["ADMIN_PASSWORD", "JWT_SECRET"]) {
    if (!hasDevVar(key)) problems.push(`${devVarsPath} 缺少 ${key}`);
  }
}

for (const bin of optionalBins) {
  if (!hasCommand(bin)) warnings.push(`可选命令未安装: ${bin}`);
}

const cloudflareTokenReady = Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
const wranglerOAuthReady = existsSync(`${process.env.HOME || ""}/.config/.wrangler/config/default.toml`);
if (!cloudflareTokenReady && !wranglerOAuthReady) {
  warnings.push("Cloudflare 认证未就绪；本地开发可先跳过，部署前需 wrangler login 或配置 CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID");
}

console.log("Monolith local environment");
console.log(`Node: ${nodeVersion || "missing"}${nvmrc ? ` (.nvmrc: ${nvmrc})` : ""}`);
console.log(`npm:  ${npmVersion || "missing"}`);
console.log("");

if (problems.length === 0) {
  console.log("[ok] 本地开发必需项已就绪。");
} else {
  console.log("[fail] 本地开发必需项缺失或异常:");
  for (const problem of problems) console.log(`- ${problem}`);
}

if (warnings.length > 0) {
  console.log("");
  console.log("[warn] 可选项或环境提示:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

process.exit(problems.length === 0 ? 0 : 1);
