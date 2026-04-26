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
  // —— 新增维度 ——
  hourlyHeatmap: { dow: number; hour: number; count: number }[]; // 0=周日..6=周六, hour 0-23
  durationBuckets: { bucket: string; count: number }[]; // 0-10s / 10-30s / 30s-1m / 1-3m / 3-10m / 10m+
  entryPages: { path: string; count: number }[]; // 入口页（每个 visitor 第一次访问的页面）
  exitPages: { path: string; count: number }[]; // 出口页（每个 visitor 最后访问的页面）
  visitorTypes: { type: "new" | "returning"; count: number }[]; // 新老访客（窗口内首次访问视为新）
  bounceRate: number; // 跳出率（只浏览 1 个页面的 visitor 占比，0-1）
  pagesPerVisitor: number; // 人均访问页面数
  topReferersFull: { referer: string; count: number }[]; // 引荐扩展到 20 条
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
    heatmap,
    durB1,
    durB2,
    durB3,
    durB4,
    durB5,
    durB6,
    entryPagesRows,
    exitPagesRows,
    bounceVisitors,
    bounceBouncers,
    referersFull,
    directAccess,
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
    // —— 新增：小时 × 星期 热力图（duration=0 的纯 pageview 也算一次访问） ——
    runSql<{ dow: number; hour: number; cnt: number }>(
      env,
      `SELECT toDayOfWeek(timestamp) AS dow, toHour(timestamp) AS hour, SUM(_sample_interval) AS cnt
       FROM ${DATASET} WHERE timestamp > NOW() - ${since}
       GROUP BY dow, hour ORDER BY dow, hour FORMAT JSON`,
    ),
    // —— 新增：停留时长分桶（毫秒）：6 条独立查询并发 ——
    runSql<{ cnt: number }>(
      env,
      `SELECT SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND double1 > 0 AND double1 < 10000 FORMAT JSON`,
    ),
    runSql<{ cnt: number }>(
      env,
      `SELECT SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND double1 >= 10000 AND double1 < 30000 FORMAT JSON`,
    ),
    runSql<{ cnt: number }>(
      env,
      `SELECT SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND double1 >= 30000 AND double1 < 60000 FORMAT JSON`,
    ),
    runSql<{ cnt: number }>(
      env,
      `SELECT SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND double1 >= 60000 AND double1 < 180000 FORMAT JSON`,
    ),
    runSql<{ cnt: number }>(
      env,
      `SELECT SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND double1 >= 180000 AND double1 < 600000 FORMAT JSON`,
    ),
    runSql<{ cnt: number }>(
      env,
      `SELECT SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND double1 >= 600000 FORMAT JSON`,
    ),
    // —— 新增：入口页（referer 为空 = 直接访问/外链着陆的页面 Top） ——
    runSql<{ path: string; cnt: number }>(
      env,
      `SELECT blob2 AS path, SUM(_sample_interval) AS cnt
       FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND blob4 = ''
       GROUP BY path ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    // —— 新增：出口页（停留时间 > 0 但短的页面，近似为离开点） ——
    runSql<{ path: string; cnt: number }>(
      env,
      `SELECT blob2 AS path, SUM(_sample_interval) AS cnt
       FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND double1 > 0 AND double1 < 5000
       GROUP BY path ORDER BY cnt DESC LIMIT 10 FORMAT JSON`,
    ),
    // —— 新增：跳出 + 人均访问页数（基于 visitor session）：拆 3 条 ——
    runSql<{ visitors: number; total_pv: number }>(
      env,
      `SELECT COUNT() AS visitors, SUM(pv) AS total_pv FROM (
         SELECT blob10 AS vid, SUM(_sample_interval) AS pv
         FROM ${DATASET}
         WHERE timestamp > NOW() - ${since} AND blob10 != ''
         GROUP BY vid
       ) FORMAT JSON`,
    ),
    runSql<{ bouncers: number }>(
      env,
      `SELECT COUNT() AS bouncers FROM (
         SELECT blob10 AS vid, SUM(_sample_interval) AS pv
         FROM ${DATASET}
         WHERE timestamp > NOW() - ${since} AND blob10 != ''
         GROUP BY vid
         HAVING pv = 1
       ) FORMAT JSON`,
    ),
    // —— 新增：扩展引荐 Top 20（仅非空 referer，直接访问单独算） ——
    runSql<{ referer: string; cnt: number }>(
      env,
      `SELECT blob4 AS referer, SUM(_sample_interval) AS cnt
       FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND blob4 != ''
       GROUP BY referer ORDER BY cnt DESC LIMIT 20 FORMAT JSON`,
    ),
    // —— 新增：直接访问总量（referer 为空） ——
    runSql<{ cnt: number }>(
      env,
      `SELECT SUM(_sample_interval) AS cnt FROM ${DATASET}
       WHERE timestamp > NOW() - ${since} AND blob4 = '' FORMAT JSON`,
    ),
  ]);

  const totalRow = totals[0] || { total: 0, uv: 0, avg_dur: 0 };
  // 跳出率 / 人均页数
  const visitorsRow = bounceVisitors[0] || { visitors: 0, total_pv: 0 };
  const bouncersRow = bounceBouncers[0] || { bouncers: 0 };
  const visitors = Number(visitorsRow.visitors) || 0;
  const bouncers = Number(bouncersRow.bouncers) || 0;
  const totalPv = Number(visitorsRow.total_pv) || 0;
  const bounceRate = visitors > 0 ? bouncers / visitors : 0;
  const pagesPerVisitor = visitors > 0 ? totalPv / visitors : 0;

  // 新老访客比：拆为两条查询并行（窗口内首访 > 24h 前 = old，否则 new）
  // AE 不支持 CASE WHEN，改用两条 HAVING 过滤
  let newVisitors = 0;
  let returningVisitors = 0;
  try {
    const [newRows, oldRows] = await Promise.all([
      runSql<{ cnt: number }>(
        env,
        `SELECT COUNT() AS cnt FROM (
           SELECT blob10 AS vid, MIN(timestamp) AS min_ts
           FROM ${DATASET}
           WHERE timestamp > NOW() - ${since} AND blob10 != ''
           GROUP BY vid
           HAVING min_ts > NOW() - INTERVAL '1' DAY
         ) FORMAT JSON`,
      ),
      runSql<{ cnt: number }>(
        env,
        `SELECT COUNT() AS cnt FROM (
           SELECT blob10 AS vid, MIN(timestamp) AS min_ts
           FROM ${DATASET}
           WHERE timestamp > NOW() - ${since} AND blob10 != ''
           GROUP BY vid
           HAVING min_ts <= NOW() - INTERVAL '1' DAY
         ) FORMAT JSON`,
      ),
    ]);
    newVisitors = Number(newRows[0]?.cnt) || 0;
    returningVisitors = Number(oldRows[0]?.cnt) || 0;
  } catch {
    // 静默降级：visitorAge 查询失败不影响主响应
  }

  // 拼接停留分桶（6 条独立查询 → 命名桶）
  const durationBuckets = [
    { bucket: "0-10s", count: Number(durB1[0]?.cnt) || 0 },
    { bucket: "10-30s", count: Number(durB2[0]?.cnt) || 0 },
    { bucket: "30s-1m", count: Number(durB3[0]?.cnt) || 0 },
    { bucket: "1-3m", count: Number(durB4[0]?.cnt) || 0 },
    { bucket: "3-10m", count: Number(durB5[0]?.cnt) || 0 },
    { bucket: "10m+", count: Number(durB6[0]?.cnt) || 0 },
  ];

  // 引荐 Top 20：把直接访问拼到首位（按数量重排）
  const directCount = Number(directAccess[0]?.cnt) || 0;
  const referersFullList = referersFull.map((r) => ({
    referer: r.referer,
    count: Number(r.cnt) || 0,
  }));
  if (directCount > 0) {
    referersFullList.push({ referer: "(直接访问)", count: directCount });
    referersFullList.sort((a, b) => b.count - a.count);
    referersFullList.splice(20);
  }

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
    hourlyHeatmap: heatmap.map((r) => ({
      dow: Number(r.dow) || 0,
      hour: Number(r.hour) || 0,
      count: Number(r.cnt) || 0,
    })),
    durationBuckets,
    entryPages: entryPagesRows.map((r) => ({ path: r.path, count: Number(r.cnt) || 0 })),
    exitPages: exitPagesRows.map((r) => ({ path: r.path, count: Number(r.cnt) || 0 })),
    visitorTypes: [
      { type: "new", count: newVisitors },
      { type: "returning", count: returningVisitors },
    ],
    bounceRate,
    pagesPerVisitor,
    topReferersFull: referersFullList,
  };
}
