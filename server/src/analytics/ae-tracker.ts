/**
 * Cloudflare Analytics Engine 写入封装（CF 专属）
 * 灵感来源: HanAnalytics (MIT) — https://github.com/uxiaohan/HanAnalytics
 *
 * AE 数据点结构：
 *   - blobs   : 字符串维度 (最多 20 个，每个 ≤ 5120 字节)
 *   - doubles : 数值维度 (最多 20 个，64-bit double)
 *   - indexes : 高基数索引 (最多 1 个，≤ 96 字节，用于查询 sample)
 *
 * 字段约定（查询端必须保持一致）：
 *   blob1  = website (站点标识，多站点支持)
 *   blob2  = path
 *   blob3  = country
 *   blob4  = referer (host only)
 *   blob5  = device (desktop/mobile/tablet/bot)
 *   blob6  = browser
 *   blob7  = os
 *   blob8  = screen (例 "1920x1080")
 *   blob9  = language (浏览器首选语言, 例 "zh-CN")
 *   blob10 = visitor_id (浏览器指纹哈希前缀, 用于 UV 估算)
 *   double1 = duration_ms (停留时长，0 = pageview 上报)
 *   index1  = website (作为采样索引，便于按站点过滤)
 */

import { parseUserAgent, refererHost } from "./ua-parser";

export type TrackPayload = {
  website?: string; // data-website-id
  path: string;
  referer?: string;
  screen?: string; // "WxH"
  language?: string;
  visitorId?: string; // 客户端生成的访客指纹（哈希后）
  duration?: number; // 停留时长(ms)，可选
};

export type TrackContext = {
  ae: AnalyticsEngineDataset | undefined;
  userAgent: string | undefined;
  country: string | undefined;
};

/**
 * 写入一条 AE 数据点。AE 不可用时静默跳过（保证 Turso/PG 后端不崩）。
 */
export function writeAnalyticsPoint(payload: TrackPayload, ctx: TrackContext): void {
  if (!ctx.ae) return; // 非 CF 部署 → 直接跳过
  const { device, browser, os } = parseUserAgent(ctx.userAgent);
  const website = (payload.website || "default").slice(0, 64);
  ctx.ae.writeDataPoint({
    blobs: [
      website,
      payload.path.slice(0, 256),
      (ctx.country || "XX").slice(0, 4),
      refererHost(payload.referer).slice(0, 128),
      device,
      browser,
      os,
      (payload.screen || "").slice(0, 16),
      (payload.language || "").slice(0, 16),
      (payload.visitorId || "").slice(0, 16),
    ],
    doubles: [Math.max(0, Math.min(payload.duration || 0, 86400000))], // 上限 24h
    indexes: [website], // 采样索引
  });
}

/**
 * 校验站点白名单。空白名单 = 全部放行。
 * 格式: "example.com|blog.foo.com"
 */
export function isWebsiteAllowed(origin: string | null | undefined, whitelist: string | undefined): boolean {
  if (!whitelist || whitelist.trim() === "") return true;
  if (!origin) return false;
  let host = origin;
  try { host = new URL(origin).hostname; } catch { /* origin 已是 host */ }
  const allowed = whitelist.split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allowed.some((d) => host.toLowerCase() === d || host.toLowerCase().endsWith("." + d));
}
