/**
 * 轻量 UA 解析器 (Cloudflare Workers 友好，零依赖)
 * 灵感来源: HanAnalytics (MIT) — https://github.com/uxiaohan/HanAnalytics
 *
 * 仅识别主流浏览器 / 操作系统 / 设备类型，覆盖率约 95%
 * 不引入 ua-parser-js 等大依赖，保持 Worker 冷启动 < 5ms
 */

export type ParsedUA = {
  device: "desktop" | "mobile" | "tablet" | "bot";
  browser: string; // chrome / firefox / safari / edge / opera / other
  os: string; // windows / macos / linux / ios / android / other
};

const BOT_RE = /bot|crawl|spider|slurp|bing|google|baidu|yandex|duckduck|facebook|twitter|telegram|whatsapp|preview/i;
const TABLET_RE = /ipad|tablet|playbook|silk/i;
const MOBILE_RE = /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i;

export function parseUserAgent(uaInput: string | undefined | null): ParsedUA {
  const ua = (uaInput || "").toLowerCase();
  if (!ua) return { device: "desktop", browser: "other", os: "other" };

  // 设备类型（顺序敏感：bot > tablet > mobile > desktop）
  let device: ParsedUA["device"] = "desktop";
  if (BOT_RE.test(ua)) device = "bot";
  else if (TABLET_RE.test(ua)) device = "tablet";
  else if (MOBILE_RE.test(ua)) device = "mobile";

  // 浏览器（顺序敏感：edge 在 chrome 之前，opera 在 chrome 之前）
  let browser = "other";
  if (/edg\//.test(ua)) browser = "edge";
  else if (/opr\/|opera/.test(ua)) browser = "opera";
  else if (/firefox|fxios/.test(ua)) browser = "firefox";
  else if (/chrome|crios/.test(ua)) browser = "chrome";
  else if (/safari/.test(ua)) browser = "safari";

  // 操作系统
  let os = "other";
  if (/windows nt/.test(ua)) os = "windows";
  else if (/iphone|ipad|ipod/.test(ua)) os = "ios";
  else if (/mac os x/.test(ua)) os = "macos";
  else if (/android/.test(ua)) os = "android";
  else if (/linux/.test(ua)) os = "linux";

  return { device, browser, os };
}

/** 从 Referer URL 提取 host（失败返回空字符串） */
export function refererHost(referer: string | undefined | null): string {
  if (!referer) return "";
  try {
    return new URL(referer).hostname.toLowerCase();
  } catch {
    return "";
  }
}
