/**
 * 客户端访客埋点工具（CF Analytics Engine 增强版）
 * 灵感来源: HanAnalytics (MIT) — https://github.com/uxiaohan/HanAnalytics
 *
 * 工作原理：
 *   1. 首次加载生成稳定的访客 ID（localStorage 缓存 30 天，不含 PII）
 *   2. 路由变化 / 首屏渲染 时调用 trackPageview
 *   3. 页面 unload / pagehide 时上报本次停留时长（duration）
 *   4. 后端 AE 不可用 → 接口直接 204，前端无感
 */

const API_BASE = import.meta.env.VITE_API_URL || "";
const TRACK_ENDPOINT = `${API_BASE}/api/track`;
const VID_KEY = "monolith_vid";
const VID_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

let pageEnterAt = 0;
let lastTrackedPath = "";

/** 32-bit FNV-1a 哈希，输出 base36 字符串（不含 PII） */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

/** 获取或生成稳定的访客 ID（仅写本地，不入 cookie） */
function getVisitorId(): string {
  try {
    const raw = localStorage.getItem(VID_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; ts: number };
      if (Date.now() - parsed.ts < VID_TTL_MS && parsed.id) return parsed.id;
    }
  } catch { /* ignore */ }

  const seed = `${Date.now()}|${Math.random()}|${navigator.userAgent}|${screen.width}x${screen.height}`;
  const id = hash(seed);
  try {
    localStorage.setItem(VID_KEY, JSON.stringify({ id, ts: Date.now() }));
  } catch { /* localStorage 满或被禁，忽略 */ }
  return id;
}

type TrackBody = {
  website: string;
  path: string;
  referer: string;
  screen: string;
  language: string;
  visitorId: string;
  duration: number;
};

function send(body: TrackBody, useBeacon: boolean): void {
  const json = JSON.stringify(body);
  if (useBeacon && navigator.sendBeacon) {
    // sendBeacon 在 unload 时最可靠
    const blob = new Blob([json], { type: "application/json" });
    navigator.sendBeacon(TRACK_ENDPOINT, blob);
    return;
  }
  // keepalive 让请求在页面切换时也能完成
  fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
    keepalive: true,
    credentials: "omit",
  }).catch(() => { /* 静默失败，埋点永远不影响业务 */ });
}

/** 上报一次 pageview（路由变化时调用） */
export function trackPageview(path: string, website = "default"): void {
  if (!path || path === lastTrackedPath) return;
  // 后台路径不上报，保护管理员隐私 + 减少噪音
  if (path.startsWith("/admin")) {
    lastTrackedPath = path;
    pageEnterAt = Date.now();
    return;
  }

  // 上报上一页停留时长
  if (lastTrackedPath && pageEnterAt > 0) {
    send(
      {
        website,
        path: lastTrackedPath,
        referer: document.referrer || "",
        screen: `${screen.width}x${screen.height}`,
        language: navigator.language || "",
        visitorId: getVisitorId(),
        duration: Date.now() - pageEnterAt,
      },
      false,
    );
  }

  // 上报新页面 pageview
  lastTrackedPath = path;
  pageEnterAt = Date.now();
  send(
    {
      website,
      path,
      referer: document.referrer || "",
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language || "",
      visitorId: getVisitorId(),
      duration: 0,
    },
    false,
  );
}

let unloadBound = false;
/** 绑定 pagehide 事件，确保最后一次停留时长能上报（仅绑定一次） */
export function bindUnloadTracker(website = "default"): void {
  if (unloadBound) return;
  unloadBound = true;
  const flush = () => {
    if (!lastTrackedPath || pageEnterAt <= 0) return;
    if (lastTrackedPath.startsWith("/admin")) return;
    send(
      {
        website,
        path: lastTrackedPath,
        referer: document.referrer || "",
        screen: `${screen.width}x${screen.height}`,
        language: navigator.language || "",
        visitorId: getVisitorId(),
        duration: Date.now() - pageEnterAt,
      },
      true,
    );
  };
  // pagehide 比 unload 更可靠（兼容 BFCache）
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
