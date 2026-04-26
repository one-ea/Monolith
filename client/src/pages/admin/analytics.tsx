import { useState, useEffect } from "react";
import { fetchAnalytics, type AnalyticsData } from "@/lib/api";
import { Globe, Monitor, Smartphone, Tablet, Bot, ExternalLink, TrendingUp, BarChart3, Cloud } from "lucide-react";
import { AnalyticsAEView } from "./analytics-ae";

type TabKey = "basic" | "ae";

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  bot: Bot,
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: "桌面端",
  mobile: "移动端",
  tablet: "平板",
  bot: "爬虫",
};

// 国旗 emoji 转换
function countryFlag(code: string): string {
  if (!code || code === "XX" || code.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

// 访问趋势图：柱状 + 折线叠加 + 网格参考线，hover 高亮当日
function TrendChart({ data, max }: { data: { date: string; count: number }[]; max: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 200;
  const PAD_T = 16;
  const PAD_B = 36;
  const PAD_X = 24;
  const innerH = H - PAD_T - PAD_B;
  const innerW = W - PAD_X * 2;
  const n = data.length;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const barW = n > 0 ? Math.min(40, (innerW / n) * 0.55) : 0;
  const safeMax = max || 1;

  // 网格 4 等分（含顶/底）
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: PAD_T + innerH * (1 - p),
    label: Math.round(safeMax * p),
  }));

  const points = data.map((d, i) => ({
    x: PAD_X + (n > 1 ? step * i : innerW / 2),
    y: PAD_T + innerH * (1 - d.count / safeMax),
    count: d.count,
    date: d.date,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${PAD_T + innerH} L ${points[0].x.toFixed(1)} ${PAD_T + innerH} Z`
    : "";

  return (
    <div className="px-[16px] pt-[12px] pb-[8px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none" role="img" aria-label="访问趋势图">
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.65 0.15 200)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.65 0.15 200)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trendBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.16 200)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="oklch(0.55 0.18 220)" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        {/* 网格 + Y 轴刻度 */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_X} x2={W - PAD_X} y1={g.y} y2={g.y} stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.08} strokeDasharray={i === gridLines.length - 1 ? "0" : "3 4"} />
            <text x={PAD_X - 6} y={g.y + 3} textAnchor="end" className="fill-current opacity-30" fontSize="10" fontFamily="monospace">{g.label}</text>
          </g>
        ))}

        {/* 柱子 */}
        {points.map((p, i) => {
          const barH = PAD_T + innerH - p.y;
          return (
            <rect
              key={`b-${i}`}
              x={p.x - barW / 2}
              y={p.y}
              width={barW}
              height={Math.max(0, barH)}
              rx={2}
              fill="url(#trendBar)"
              opacity={hover === null || hover === i ? 1 : 0.45}
              style={{ transition: "opacity .2s" }}
            />
          );
        })}

        {/* 面积 + 折线 */}
        {areaPath && <path d={areaPath} fill="url(#trendArea)" />}
        {linePath && <path d={linePath} fill="none" stroke="oklch(0.78 0.14 200)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}

        {/* 数据点 + 数值 */}
        {points.map((p, i) => (
          <g key={`p-${i}`}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="oklch(0.85 0.15 200)" stroke="oklch(0.13 0.005 260)" strokeWidth={1.5} style={{ transition: "r .15s" }} />
            <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-current opacity-70" fontSize="10" fontFamily="monospace" fontWeight="600">{p.count}</text>
          </g>
        ))}

        {/* X 轴日期 */}
        {points.map((p, i) => (
          <text key={`x-${i}`} x={p.x} y={H - PAD_B + 18} textAnchor="middle" className="fill-current opacity-40" fontSize="10" fontFamily="monospace">{p.date.slice(5)}</text>
        ))}

        {/* 透明 hover 区域 */}
        {points.map((p, i) => {
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

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("basic");

  useEffect(() => {
    document.title = "访客分析 | Monolith";
  }, []);

  useEffect(() => {
    if (tab !== "basic") return;
    setLoading(true);
    fetchAnalytics(days)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch(() => {
        setData(null);
        setError("访客分析数据加载失败，请稍后重试。");
      })
      .finally(() => setLoading(false));
  }, [days, tab]);

  const totalVisits = data?.visitsByDay.reduce((s, d) => s + d.count, 0) ?? 0;
  const maxDayCount = data ? Math.max(...data.visitsByDay.map((d) => d.count), 1) : 1;

  return (
    <div className="mx-auto w-full max-w-[960px] py-[24px] sm:py-[36px] px-[16px] sm:px-[20px]">
      {/* 顶栏 */}
      <div className="mb-[28px]">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            <BarChart3 className="inline h-[20px] w-[20px] mr-[8px] text-cyan-400" />
            访客分析
          </h1>
          <div className="flex gap-[4px]">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-[10px] py-[4px] rounded-md text-[12px] transition-colors ${
                  days === d
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground/40 hover:text-foreground"
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>

        {/* Tab 切换：基础统计 / AE 增强 (CF 专属) */}
        <div className="mt-[20px] flex items-center gap-[2px] border-b border-border/30">
          <button
            onClick={() => setTab("basic")}
            className={`px-[14px] py-[8px] text-[13px] -mb-[1px] border-b-2 transition-colors ${
              tab === "basic"
                ? "border-cyan-400 text-foreground"
                : "border-transparent text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            基础统计
          </button>
          <button
            onClick={() => setTab("ae")}
            className={`px-[14px] py-[8px] text-[13px] -mb-[1px] border-b-2 transition-colors flex items-center gap-[6px] ${
              tab === "ae"
                ? "border-cyan-400 text-foreground"
                : "border-transparent text-muted-foreground/50 hover:text-foreground"
            }`}
            title="基于 Cloudflare Analytics Engine，仅在 D1 部署可用"
          >
            <Cloud className="h-[12px] w-[12px]" />
            AE 增强
            <span className="text-[10px] text-amber-400/70 font-mono">CF</span>
          </button>
        </div>
      </div>

      {tab === "ae" ? (
        <AnalyticsAEView days={days} />
      ) : loading ? (
        <div className="text-center text-muted-foreground/40 py-[60px]">加载中...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-[16px] py-[24px] text-center text-[13px] text-red-400">{error}</div>
      ) : !data ? (
        <div className="text-center text-muted-foreground/40 py-[60px]">暂无数据</div>
      ) : (
        <div className="space-y-[20px]">
          {/* 总览卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px]">
            <div className="analytics-card">
              <span className="analytics-card__label">总访问</span>
              <span className="analytics-card__value">{totalVisits}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__label">日均</span>
              <span className="analytics-card__value">
                {days > 0 ? Math.round(totalVisits / days) : 0}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__label">国家/地区</span>
              <span className="analytics-card__value">{data.topCountries.length}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card__label">引荐来源</span>
              <span className="analytics-card__value">{data.topReferers.length}</span>
            </div>
          </div>

          {/* 趋势图（SVG 折线 + 柱状叠加） */}
          <div className="analytics-section">
            <h2 className="analytics-section__title">
              <TrendingUp className="h-[14px] w-[14px]" />
              访问趋势
              <span className="ml-auto text-[11px] text-muted-foreground/40 font-normal">
                峰值 {maxDayCount} · 日均 {days > 0 ? Math.round(totalVisits / days) : 0}
              </span>
            </h2>
            {data.visitsByDay.length === 0 ? (
              <div className="text-center text-muted-foreground/30 py-[40px] text-[12px]">暂无访问数据</div>
            ) : (
              <TrendChart data={data.visitsByDay} max={maxDayCount} />
            )}
          </div>

          {/* 下方 2 列布局 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
            {/* 国家分布 */}
            <div className="analytics-section">
              <h2 className="analytics-section__title">
                <Globe className="h-[14px] w-[14px]" />
                国家 / 地区
              </h2>
              <div className="analytics-list">
                {data.topCountries.length === 0 ? (
                  <div className="analytics-list__empty">暂无数据</div>
                ) : (
                  data.topCountries.map((item) => (
                    <div key={item.country} className="analytics-list__row">
                      <span className="analytics-list__name">
                        {countryFlag(item.country)} {item.country}
                      </span>
                      <div className="analytics-list__bar-track">
                        <div
                          className="analytics-list__bar-fill analytics-list__bar-fill--blue"
                          style={{ width: `${(item.count / data.topCountries[0].count) * 100}%` }}
                        />
                      </div>
                      <span className="analytics-list__count">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 设备类型 */}
            <div className="analytics-section">
              <h2 className="analytics-section__title">
                <Monitor className="h-[14px] w-[14px]" />
                设备类型
              </h2>
              <div className="analytics-list">
                {data.deviceBreakdown.length === 0 ? (
                  <div className="analytics-list__empty">暂无数据</div>
                ) : (
                  data.deviceBreakdown.map((item) => {
                    const Icon = DEVICE_ICONS[item.device] || Monitor;
                    return (
                      <div key={item.device} className="analytics-list__row">
                        <span className="analytics-list__name">
                          <Icon className="inline h-[13px] w-[13px] mr-[6px] opacity-50" />
                          {DEVICE_LABELS[item.device] || item.device}
                        </span>
                        <div className="analytics-list__bar-track">
                          <div
                            className="analytics-list__bar-fill analytics-list__bar-fill--green"
                            style={{ width: `${(item.count / data.deviceBreakdown[0].count) * 100}%` }}
                          />
                        </div>
                        <span className="analytics-list__count">{item.count}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 引荐来源 */}
            <div className="analytics-section">
              <h2 className="analytics-section__title">
                <ExternalLink className="h-[14px] w-[14px]" />
                引荐来源
              </h2>
              <div className="analytics-list">
                {data.topReferers.length === 0 ? (
                  <div className="analytics-list__empty">暂无引荐数据</div>
                ) : (
                  data.topReferers.map((item) => (
                    <div key={item.referer} className="analytics-list__row">
                      <span className="analytics-list__name analytics-list__name--mono">
                        {item.referer}
                      </span>
                      <div className="analytics-list__bar-track">
                        <div
                          className="analytics-list__bar-fill analytics-list__bar-fill--violet"
                          style={{ width: `${(item.count / data.topReferers[0].count) * 100}%` }}
                        />
                      </div>
                      <span className="analytics-list__count">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 热门页面 */}
            <div className="analytics-section">
              <h2 className="analytics-section__title">
                <BarChart3 className="h-[14px] w-[14px]" />
                热门页面
              </h2>
              <div className="analytics-list">
                {data.topPages.length === 0 ? (
                  <div className="analytics-list__empty">暂无数据</div>
                ) : (
                  data.topPages.map((item) => (
                    <div key={item.path} className="analytics-list__row">
                      <span className="analytics-list__name analytics-list__name--mono">
                        {item.path}
                      </span>
                      <div className="analytics-list__bar-track">
                        <div
                          className="analytics-list__bar-fill analytics-list__bar-fill--amber"
                          style={{ width: `${(item.count / data.topPages[0].count) * 100}%` }}
                        />
                      </div>
                      <span className="analytics-list__count">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
