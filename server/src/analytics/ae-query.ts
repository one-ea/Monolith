/**
 * Cloudflare Analytics Engine SQL API 查询封装
 * 灵感来源: HanAnalytics (MIT) — https://github.com/uxiaohan/HanAnalytics
 *
 * 通过 https://api.cloudflare.com/client/v4/accounts/{id}/analytics_engine/sql 查询。
 * 需要 API Token 具备 "Account Analytics: Read" 权限。
 *
 * 字段映射详见 ae-tracker.ts 顶部注释。
 */

const AE_SQL_ENDPOINT = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

export type AEQueryEnv = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
};

export type AEAnalyticsResult = {
  visitsByDay: { date: string; count: number; uv: number }[];
  topCountries: { country: string; count: number }[];
  topReferers: { referer: string; count: number }[];
  deviceBreakdown: { device: string; count: number }[];
  browserBreakdown: { browser: string; count: number }[];
  osBreakdown: { os: string; count: number }[];
  topPages: { path: string; count: number }[];
  topScreens: { screen: string; count: number }[];
  topLanguages: { language: string; count: number }[];
  totalVisits: number;
  uniqueVisitors: number;
  avgDuration: number; // 平均停留毫秒
};

/** 执行一条 AE SQL，返回数据数组（失败抛错） */
async function runSql<T = Record<string, unknown>>(env: AEQueryEnv, sql: string): Promise<T[]> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    throw new Error("Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN secrets for AE query");
  }
  const res = await fetch(AE_SQL_ENDPOINT(env.CLOUDFLARE_ACCOUNT_ID), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "text/plain",
    },
    body: sql,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AE SQL HTTP ${res.status}: ${text.slice(0, 256)}`);
  }
  const json = await res.json() as { data?: T[]; meta?: unknown; error?: string };
  if (json.error) throw new Error(`AE SQL error: ${json.error}`);
  return json.data || [];
}

/** AE 数据集名称必须与 wrangler.toml 一致 */
const DATASET = "monolith_analytics";

/** 把 days 限制在合法范围（AE 默认保留 31 天） */
function safeDays(days: number): number {
  const n = Math.max(1, Math.min(31, Math.floor(days || 7)));
  return n;
}

/** SQL 注入防护：只允许传入数字（days）和已知 enum，绝不拼接用户字符串 */
export async function queryAEAnalytics(env: AEQueryEnv, days: number): Promise<AEAnalyticsResult> {
  const d = safeDays(days);
  const since = `INTERVAL '${d}' DAY`;

  // 并发执行多条聚合查询
  const [
    byDay,
    byCountry,
    byReferer,
    byDevice,
    byBrowser,
    byOs,
    byPage,
    byScreen,
    byLang,
    totals,
  ] = await Promise.all([
    runSql<{ date: string; cnt: number; uv: number }>(
      env,
      `SELECT toDate(timestamp) AS date, SUM(_sample_interval) AS cnt, COUNT(DISTINCT blob10) AS uv
       FROM ${DATASET}
       WHERE timestamp > NOW() - ${since}
       GROUP BY date ORDER BY date ASC FORMAT JSON`,
    ),
    runSql<{ country: string; cnt: number }>(
      env,
      `SELECT blob3 AS country, SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND blob3 != ''
       GROUP BY country ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    runSql<{ referer: string; cnt: number }>(
      env,
      `SELECT blob4 AS referer, SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND blob4 != ''
       GROUP BY referer ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    runSql<{ device: string; cnt: number }>(
      env,
      `SELECT blob5 AS device, SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since}
       GROUP BY device ORDER BY cnt DESC FORMAT JSON`,
    ),
    runSql<{ browser: string; cnt: number }>(
      env,
      `SELECT blob6 AS browser, SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since}
       GROUP BY browser ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    runSql<{ os: string; cnt: number }>(
      env,
      `SELECT blob7 AS os, SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since}
       GROUP BY os ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    runSql<{ path: string; cnt: number }>(
      env,
      `SELECT blob2 AS path, SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since}
       GROUP BY path ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    runSql<{ screen: string; cnt: number }>(
      env,
      `SELECT blob8 AS screen, SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND blob8 != ''
       GROUP BY screen ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    runSql<{ language: string; cnt: number }>(
      env,
      `SELECT blob9 AS language, SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND blob9 != ''
       GROUP BY language ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    runSql<{ total: number; uv: number; avg_dur: number }>(
      env,
      `SELECT SUM(_sample_interval) AS total, COUNT(DISTINCT blob10) AS uv, AVG(double1) AS avg_dur
       FROM ${DATASET} WHERE timestamp > NOW() - ${since} FORMAT JSON`,
    ),
  ]);

  const totalRow = totals[0] || { total: 0, uv: 0, avg_dur: 0 };

  return {
    visitsByDay: byDay.map((r) => ({ date: r.date, count: Number(r.cnt) || 0, uv: Number(r.uv) || 0 })),
    topCountries: byCountry.map((r) => ({ country: r.country, count: Number(r.cnt) || 0 })),
    topReferers: byReferer.map((r) => ({ referer: r.referer, count: Number(r.cnt) || 0 })),
    deviceBreakdown: byDevice.map((r) => ({ device: r.device, count: Number(r.cnt) || 0 })),
    browserBreakdown: byBrowser.map((r) => ({ browser: r.browser, count: Number(r.cnt) || 0 })),
    osBreakdown: byOs.map((r) => ({ os: r.os, count: Number(r.cnt) || 0 })),
    topPages: byPage.map((r) => ({ path: r.path, count: Number(r.cnt) || 0 })),
    topScreens: byScreen.map((r) => ({ screen: r.screen, count: Number(r.cnt) || 0 })),
    topLanguages: byLang.map((r) => ({ language: r.language, count: Number(r.cnt) || 0 })),
    totalVisits: Number(totalRow.total) || 0,
    uniqueVisitors: Number(totalRow.uv) || 0,
    avgDuration: Math.round(Number(totalRow.avg_dur) || 0),
  };
}
