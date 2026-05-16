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
 *   blob11 = event_type (pageview/search)
 *   blob12 = search_query (仅 search)
 *   blob13 = result_bucket (仅 search, 0 / 1-3 / 4-9 / 10+)
 *   double1 = duration_ms (停留时长，0 = pageview 上报)
 *   double2 = result_count (仅 search)
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
  eventType?: "pageview" | "search";
  searchQuery?: string;
  resultCount?: number;
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
      (payload.eventType || "pageview").slice(0, 24),
      (payload.searchQuery || "").slice(0, 96),
      bucketResultCount(payload.resultCount),
    ],
    doubles: [
      Math.max(0, Math.min(payload.duration || 0, 86400000)), // 上限 24h
      Math.max(0, Math.min(payload.resultCount || 0, 1000)),
    ],
    indexes: [website], // 采样索引
  });
}

function bucketResultCount(count: number | undefined): string {
  const value = Math.max(0, Math.floor(count || 0));
  if (value === 0) return "0";
  if (value <= 3) return "1-3";
  if (value <= 9) return "4-9";
  return "10+";
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
