import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const IS_WIN = process.platform === "win32";

/** 解析仓库内安装的 wrangler CLI，避免依赖 npx / shell 参数拼接。 */
export function resolveWranglerCli() {
  try {
    return require.resolve("wrangler");
  } catch {
    return "";
  }
}

/**
 * 以 shell:false 直接调用本地 wrangler CLI。
 * SQL、账户 ID 等参数不会再被 Windows cmd 或 /bin/sh 二次拆分。
 */
export function runWrangler(args, options = {}) {
  const cli = resolveWranglerCli();
  if (!cli) {
    throw new Error("找不到本地 wrangler，请先在仓库根目录执行 npm ci");
  }

  const env = { ...process.env, ...(options.env || {}) };
  if (options.removeEnv) {
    for (const key of options.removeEnv) delete env[key];
  }

  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    shell: false,
    env,
    input: options.input,
    stdio: options.stdio || (options.input ? ["pipe", "inherit", "inherit"] : "inherit"),
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    throw new Error(detail || `wrangler 退出码 ${result.status}`);
  }
  return result;
}

/** 从 wrangler 的 --json 输出中提取 JSON（容忍前后日志行）。 */
export function parseWranglerJson(output) {
  const text = String(output || "").trim();
  const firstObject = text.indexOf("{");
  const lastObject = text.lastIndexOf("}");
  if (firstObject !== -1 && lastObject > firstObject) {
    try {
      return JSON.parse(text.slice(firstObject, lastObject + 1));
    } catch {
      /* fall through to array */
    }
  }
  const firstArray = text.indexOf("[");
  const lastArray = text.lastIndexOf("]");
  if (firstArray !== -1 && lastArray > firstArray) {
    try {
      return JSON.parse(text.slice(firstArray, lastArray + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

export { IS_WIN };
