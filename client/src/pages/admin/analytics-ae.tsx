import { useState, useEffect } from "react";
import { fetchAEAnalytics, type AEAnalyticsData, type AEAnalyticsError } from "@/lib/api";
import { Globe, Monitor, ExternalLink, Cloud, Users, Clock, Languages, MonitorSmartphone, Activity, LogIn, LogOut, UserPlus, Repeat, Hourglass, CalendarClock } from "lucide-react";

function countryFlag(code: string): string {
  if (!code || code === "XX" || code.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "-";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} 秒`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} 分`;
  return `${(sec / 3600).toFixed(1)} 小时`;
}

type ListItem = { name: string; count: number };

// PV/UV 双系列趋势图：折线 + 数据点 + 网格线
function DualTrendChart({ data, maxValue }: { data: { date: string; count: number; uv: number }[]; maxValue: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const PAD_T = 20;
  const PAD_B = 40;
  const PAD_X = 28;
  const innerH = H - PAD_T - PAD_B;
  const innerW = W - PAD_X * 2;
  const n = data.length;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const safeMax = maxValue || 1;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: PAD_T + innerH * (1 - p),
    label: Math.round(safeMax * p),
  }));

  const project = (count: number, i: number) => ({
    x: PAD_X + (n > 1 ? step * i : innerW / 2),
    y: PAD_T + innerH * (1 - count / safeMax),
  });

  const pvPoints = data.map((d, i) => ({ ...project(d.count, i), v: d.count, date: d.date }));
  const uvPoints = data.map((d, i) => ({ ...project(d.uv, i), v: d.uv }));
  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const pvLine = buildPath(pvPoints);
  const uvLine = buildPath(uvPoints);
  const pvArea = pvPoints.length > 0
    ? `${pvLine} L ${pvPoints[pvPoints.length - 1].x.toFixed(1)} ${PAD_T + innerH} L ${pvPoints[0].x.toFixed(1)} ${PAD_T + innerH} Z`
    : "";

  return (
    <div className="px-[16px] pt-[12px] pb-[8px]">
      {/* 图例 */}
      <div className="flex items-center gap-[16px] mb-[8px] text-[11px] text-muted-foreground/60">
        <span className="flex items-center gap-[6px]">
          <span className="inline-block w-[12px] h-[2px] rounded-full" style={{ background: "oklch(0.78 0.14 200)" }} />
          PV 总访问
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="inline-block w-[12px] h-[2px] rounded-full" style={{ background: "oklch(0.75 0.18 80)" }} />
          UV 独立访客
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none" role="img" aria-label="PV / UV 趋势图">
        <defs>
          <linearGradient id="aePvArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.65 0.15 200)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="oklch(0.65 0.15 200)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {grid.map((g, i) => (
          <g key={i}>
            <line x1={PAD_X} x2={W - PAD_X} y1={g.y} y2={g.y} stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.08} strokeDasharray={i === grid.length - 1 ? "0" : "3 4"} />
            <text x={PAD_X - 6} y={g.y + 3} textAnchor="end" className="fill-current opacity-30" fontSize="10" fontFamily="monospace">{g.label}</text>
          </g>
        ))}

        {pvArea && <path d={pvArea} fill="url(#aePvArea)" />}
        {pvLine && <path d={pvLine} fill="none" stroke="oklch(0.78 0.14 200)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
        {uvLine && <path d={uvLine} fill="none" stroke="oklch(0.75 0.18 80)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />}

        {pvPoints.map((p, i) => (
          <circle key={`pv-${i}`} cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="oklch(0.85 0.15 200)" stroke="oklch(0.13 0.005 260)" strokeWidth={1.5} style={{ transition: "r .15s" }} />
        ))}
        {uvPoints.map((p, i) => (
          <circle key={`uv-${i}`} cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="oklch(0.82 0.18 80)" stroke="oklch(0.13 0.005 260)" strokeWidth={1.5} style={{ transition: "r .15s" }} />
        ))}

        {/* hover 时显示当日 PV/UV 数值在 PV 点上方 */}
        {pvPoints.map((p, i) => (
          hover === i ? (
            <g key={`tip-${i}`}>
              <text x={p.x} y={p.y - 12} textAnchor="middle" className="fill-current" opacity="0.9" fontSize="10" fontFamily="monospace" fontWeight="600">
                PV {p.v} · UV {uvPoints[i].v}
              </text>
            </g>
          ) : null
        ))}

        {pvPoints.map((p, i) => (
          <text key={`x-${i}`} x={p.x} y={H - PAD_B + 18} textAnchor="middle" className="fill-current opacity-40" fontSize="10" fontFamily="monospace">{p.date.slice(5)}</text>
        ))}

        {pvPoints.map((p, i) => {
          const w = step > 0 ? step : innerW;
          return (
            <rect
              key={`h-${i}`}
              x={p.x - w / 2}
              y={PAD_T}
              width={w}
              height={innerH + PAD_B - 16}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
    </div>
  );
}

function ListSection({ title, icon: Icon, items, accent, mono }: {
  title: string;
  icon: typeof Globe;
  items: ListItem[];
  accent: "blue" | "green" | "violet" | "amber";
  mono?: boolean;
}) {
  const max = items.length > 0 ? items[0].count : 1;
  return (
    <div className="analytics-section">
      <h2 className="analytics-section__title">
        <Icon className="h-[14px] w-[14px]" />
        {title}
      </h2>
      <div className="analytics-list">
        {items.length === 0 ? (
          <div className="analytics-list__empty">暂无数据</div>
        ) : (
          items.map((item) => (
            <div key={item.name} className="analytics-list__row">
              <span className={`analytics-list__name${mono ? " analytics-list__name--mono" : ""}`}>
                {item.name}
              </span>
              <div className="analytics-list__bar-track">
                <div
                  className={`analytics-list__bar-fill analytics-list__bar-fill--${accent}`}
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
              <span className="analytics-list__count">{item.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// 7×24 热力图：周日(0)..周六(6) × 0..23 时
function HeatmapChart({ data }: { data: { dow: number; hour: number; count: number }[] }) {
  // 注意：ClickHouse toDayOfWeek 是 1..7（周一=1, 周日=7），这里统一映射回 0..6（周日=0）
  const matrix = new Map<string, number>();
  let maxC = 1;
  for (const r of data) {
    const dow = r.dow === 7 ? 0 : r.dow; // 周日 7 → 0
    const k = `${dow}-${r.hour}`;
    matrix.set(k, r.count);
    if (r.count > maxC) maxC = r.count;
  }
  const dows = ["日", "一", "二", "三", "四", "五", "六"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const cellW = 26;
  const cellH = 18;
  const labelW = 28;
  const labelH = 18;
  const W = labelW + cellW * 24 + 8;
  const H = labelH + cellH * 7 + 4;

  return (
    <div className="px-[12px] py-[8px] overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto min-w-[640px]" role="img" aria-label="访客时段热力图">
        {hours.map((h) => (
          <text key={`hh-${h}`} x={labelW + h * cellW + cellW / 2} y={12} textAnchor="middle" className="fill-current opacity-30" fontSize="9" fontFamily="monospace">
            {h % 3 === 0 ? h : ""}
          </text>
        ))}
        {dows.map((d, di) => (
          <text key={`dd-${di}`} x={labelW - 6} y={labelH + di * cellH + cellH / 2 + 3} textAnchor="end" className="fill-current opacity-50" fontSize="10">
            {d}
          </text>
        ))}
        {dows.map((_, di) =>
          hours.map((h) => {
            const v = matrix.get(`${di}-${h}`) || 0;
            const intensity = v / maxC;
            const opacity = v === 0 ? 0.04 : 0.18 + intensity * 0.7;
            return (
              <rect
                key={`c-${di}-${h}`}
                x={labelW + h * cellW + 1}
                y={labelH + di * cellH + 1}
                width={cellW - 2}
                height={cellH - 2}
                rx={2}
                fill="oklch(0.7 0.15 200)"
                opacity={opacity}
              >
                <title>{`周${dows[di]} ${String(h).padStart(2, "0")}:00 — ${v} 次访问`}</title>
              </rect>
            );
          })
        )}
      </svg>
    </div>
  );
}

// 停留时长分桶柱图
function DurationBucketsChart({ buckets }: { buckets: { bucket: string; count: number }[] }) {
  // 强制顺序
  const order = ["0-10s", "10-30s", "30s-1m", "1-3m", "3-10m", "10m+"];
  const map = new Map(buckets.map((b) => [b.bucket, b.count]));
  const rows = order.map((k) => ({ bucket: k, count: map.get(k) || 0 }));
  const max = rows.reduce((a, b) => Math.max(a, b.count), 1);
  const total = rows.reduce((a, b) => a + b.count, 0);
  return (
    <div className="px-[16px] py-[12px] space-y-[8px]">
      {rows.map((r) => {
        const pct = max > 0 ? (r.count / max) * 100 : 0;
        const ratio = total > 0 ? ((r.count / total) * 100).toFixed(1) : "0.0";
        return (
          <div key={r.bucket} className="flex items-center gap-[12px] text-[12px]">
            <span className="w-[60px] font-mono text-muted-foreground/60">{r.bucket}</span>
            <div className="flex-1 h-[10px] rounded-full bg-foreground/5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, oklch(0.65 0.15 200), oklch(0.55 0.18 220))",
                  transition: "width .4s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </div>
            <span className="w-[60px] text-right font-mono text-muted-foreground/70">{r.count}</span>
            <span className="w-[44px] text-right font-mono text-muted-foreground/40">{ratio}%</span>
          </div>
        );
      })}
    </div>
  );
}

// 新老访客胶囊条
function VisitorRatio({ types }: { types: { type: "new" | "returning"; count: number }[] }) {
  const newCount = types.find((t) => t.type === "new")?.count || 0;
  const retCount = types.find((t) => t.type === "returning")?.count || 0;
  const total = newCount + retCount;
  const newPct = total > 0 ? (newCount / total) * 100 : 0;
  const retPct = total > 0 ? (retCount / total) * 100 : 0;
  return (
    <div className="px-[16px] py-[12px] space-y-[10px]">
      <div className="flex h-[12px] rounded-full overflow-hidden bg-foreground/5">
        <div
          className="h-full"
          style={{
            width: `${newPct}%`,
            background: "linear-gradient(90deg, oklch(0.7 0.16 200), oklch(0.6 0.18 220))",
            transition: "width .4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <div
          className="h-full"
          style={{
            width: `${retPct}%`,
            background: "linear-gradient(90deg, oklch(0.75 0.18 80), oklch(0.65 0.18 60))",
            transition: "width .4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-[6px] text-muted-foreground/70">
          <UserPlus className="h-[12px] w-[12px]" style={{ color: "oklch(0.7 0.16 200)" }} />
          新访客
          <span className="font-mono text-foreground/80">{newCount}</span>
          <span className="font-mono text-muted-foreground/40">({newPct.toFixed(1)}%)</span>
        </span>
        <span className="flex items-center gap-[6px] text-muted-foreground/70">
          <Repeat className="h-[12px] w-[12px]" style={{ color: "oklch(0.75 0.18 80)" }} />
          回访
          <span className="font-mono text-foreground/80">{retCount}</span>
          <span className="font-mono text-muted-foreground/40">({retPct.toFixed(1)}%)</span>
        </span>
      </div>
    </div>
  );
}

export function AnalyticsAEView({ days }: { days: number }) {
  const [data, setData] = useState<AEAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AEAnalyticsError | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAEAnalytics(days)
      .then((d) => { setData(d); setError(null); })
      .catch((e: AEAnalyticsError) => { setData(null); setError(e); })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <div className="text-center text-muted-foreground/40 py-[60px]">加载中...</div>;
  }

  if (error) {
    if (error.status === 501) {
      return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-[20px] py-[28px] text-center">
          <Cloud className="inline h-[24px] w-[24px] text-amber-400 mb-[12px]" />
          <div className="text-[14px] text-amber-300 mb-[6px]">AE 增强分析仅支持 Cloudflare 部署</div>
          <div className="text-[12px] text-muted-foreground/60">当前后端：{error.message}</div>
        </div>
      );
    }
    if (error.status === 503) {
      return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-[20px] py-[28px] text-center">
          <div className="text-[14px] text-amber-300 mb-[6px]">AE 配置缺失</div>
          <div className="text-[12px] text-muted-foreground/60">
            请通过 wrangler secret put 注入 CLOUDFLARE_ACCOUNT_ID 与 CLOUDFLARE_API_TOKEN
            （需 Account Analytics:Read 权限）
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-[16px] py-[24px] text-center text-[13px] text-red-400">
        {error.message}
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-muted-foreground/40 py-[60px]">暂无数据</div>;
  }

  const maxDay = Math.max(...data.visitsByDay.map((d) => Math.max(d.count, d.uv)), 1);
  const bounceRatePct = (data.bounceRate * 100).toFixed(1);
  const pagesPerVisitor = data.pagesPerVisitor.toFixed(2);

  return (
    <div className="space-y-[20px]">
      {/* 核心指标 8 张卡 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px]">
        <div className="analytics-card">
          <span className="analytics-card__label">总访问 (PV)</span>
          <span className="analytics-card__value">{data.totalVisits}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-card__label">独立访客 (UV)</span>
          <span className="analytics-card__value">{data.uniqueVisitors}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-card__label">平均停留</span>
          <span className="analytics-card__value">{formatDuration(data.avgDuration)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-card__label">国家/地区</span>
          <span className="analytics-card__value">{data.topCountries.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-card__label">跳出率</span>
          <span className="analytics-card__value">{bounceRatePct}%</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-card__label">人均页数</span>
          <span className="analytics-card__value">{pagesPerVisitor}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-card__label">浏览器种类</span>
          <span className="analytics-card__value">{data.browserBreakdown.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-card__label">引荐来源</span>
          <span className="analytics-card__value">{data.topReferersFull.length}</span>
        </div>
      </div>

      {/* 访问趋势 */}
      <div className="analytics-section">
        <h2 className="analytics-section__title">
          <Users className="h-[14px] w-[14px]" />
          访问趋势 (PV / UV)
          <span className="ml-auto text-[11px] text-muted-foreground/40 font-normal">
            峰值 {maxDay}
          </span>
        </h2>
        {data.visitsByDay.length === 0 ? (
          <div className="text-center text-muted-foreground/30 py-[40px] text-[12px]">暂无访问数据</div>
        ) : (
          <DualTrendChart data={data.visitsByDay} maxValue={maxDay} />
        )}
      </div>

      {/* 新老访客 + 停留分桶 并排 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <div className="analytics-section">
          <h2 className="analytics-section__title">
            <Activity className="h-[14px] w-[14px]" />
            新老访客占比
            <span className="ml-auto text-[11px] text-muted-foreground/40 font-normal">
              基于 24h 首访界限
            </span>
          </h2>
          {data.visitorTypes.every((t) => t.count === 0) ? (
            <div className="text-center text-muted-foreground/30 py-[40px] text-[12px]">暂无访客数据</div>
          ) : (
            <VisitorRatio types={data.visitorTypes} />
          )}
        </div>
        <div className="analytics-section">
          <h2 className="analytics-section__title">
            <Hourglass className="h-[14px] w-[14px]" />
            停留时长分布
            <span className="ml-auto text-[11px] text-muted-foreground/40 font-normal">
              不含 0 秒纯 PV
            </span>
          </h2>
          {data.durationBuckets.length === 0 ? (
            <div className="text-center text-muted-foreground/30 py-[40px] text-[12px]">暂无停留数据</div>
          ) : (
            <DurationBucketsChart buckets={data.durationBuckets} />
          )}
        </div>
      </div>

      {/* 时段热力图 */}
      <div className="analytics-section">
        <h2 className="analytics-section__title">
          <CalendarClock className="h-[14px] w-[14px]" />
          访客时段热力图
          <span className="ml-auto text-[11px] text-muted-foreground/40 font-normal">
            UTC 时间 · 颜色越亮访问越多
          </span>
        </h2>
        {data.hourlyHeatmap.length === 0 ? (
          <div className="text-center text-muted-foreground/30 py-[40px] text-[12px]">暂无时段数据</div>
        ) : (
          <HeatmapChart data={data.hourlyHeatmap} />
        )}
      </div>

      {/* 入口 / 出口页 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <ListSection
          title="入口页 Top 10"
          icon={LogIn}
          accent="green"
          mono
          items={data.entryPages.map((i) => ({ name: i.path, count: i.count }))}
        />
        <ListSection
          title="出口页 Top 10"
          icon={LogOut}
          accent="amber"
          mono
          items={data.exitPages.map((i) => ({ name: i.path, count: i.count }))}
        />
      </div>

      {/* 全维度分布列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
        <ListSection
          title="国家 / 地区"
          icon={Globe}
          accent="blue"
          items={data.topCountries.map((i) => ({ name: `${countryFlag(i.country)} ${i.country}`, count: i.count }))}
        />
        <ListSection
          title="设备类型"
          icon={Monitor}
          accent="green"
          items={data.deviceBreakdown.map((i) => ({ name: i.device, count: i.count }))}
        />
        <ListSection
          title="浏览器"
          icon={MonitorSmartphone}
          accent="violet"
          items={data.browserBreakdown.map((i) => ({ name: i.browser, count: i.count }))}
        />
        <ListSection
          title="操作系统"
          icon={Monitor}
          accent="amber"
          items={data.osBreakdown.map((i) => ({ name: i.os, count: i.count }))}
        />
        <ListSection
          title="引荐来源 Top 20"
          icon={ExternalLink}
          accent="violet"
          mono
          items={data.topReferersFull.map((i) => ({ name: i.referer, count: i.count }))}
        />
        <ListSection
          title="热门页面"
          icon={Clock}
          accent="amber"
          mono
          items={data.topPages.map((i) => ({ name: i.path, count: i.count }))}
        />
        <ListSection
          title="屏幕分辨率"
          icon={MonitorSmartphone}
          accent="blue"
          mono
          items={data.topScreens.map((i) => ({ name: i.screen, count: i.count }))}
        />
        <ListSection
          title="语言"
          icon={Languages}
          accent="green"
          items={data.topLanguages.map((i) => ({ name: i.language, count: i.count }))}
        />
      </div>
    </div>
  );
}
