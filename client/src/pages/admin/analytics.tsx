import { useEffect, useState } from "react";
import {
  fetchAEAnalytics,
  fetchAnalytics,
  type AEAnalyticsData,
  type AEAnalyticsError,
  type AnalyticsData,
  type AnalyticsInsight,
  type AnalyticsKpi,
  type AnalyticsPageFilter,
  type AnalyticsShareItem,
  type AnalyticsTrendPoint,
  type ContentLifecycleItem,
  type ContentSuggestion,
  type SearchAnalytics,
} from "@/lib/api";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Cloud,
  ClipboardList,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Lightbulb,
  Monitor,
  MousePointer2,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AnalyticsAEAdvancedView } from "./analytics-ae";

type AEStatus = "loading" | "ready" | "unavailable" | "error";
type RankItem = { name: string; count: number; share?: number; meaning?: string };
type PageFilterKey = AnalyticsPageFilter["key"];

const toneClass: Record<AnalyticsInsight["tone"], string> = {
  good: "analytics-insight--good",
  warning: "analytics-insight--warning",
  danger: "analytics-insight--danger",
  neutral: "analytics-insight--neutral",
};

function formatChange(value: number, percent: number | null): string {
  if (percent === null) return value > 0 ? "新增基线" : "持平";
  return `${value >= 0 ? "+" : ""}${value} · ${percent >= 0 ? "+" : ""}${Math.round(percent * 100)}%`;
}

function formatShare(value?: number): string {
  if (typeof value !== "number") return "";
  return `${(value * 100).toFixed(1)}%`;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="analytics-empty">
      <Lightbulb className="h-[18px] w-[18px]" />
      <div>
        <div className="analytics-empty__title">{title}</div>
        <div className="analytics-empty__detail">{detail}</div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-[16px]" aria-label="分析数据加载中">
      <div className="analytics-skeleton h-[112px]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[12px]">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="analytics-skeleton h-[120px]" />
        ))}
      </div>
      <div className="analytics-skeleton h-[280px]" />
    </div>
  );
}

function ConclusionPanel({ insights }: { insights: AnalyticsInsight[] }) {
  return (
    <section className="analytics-section">
      <div className="analytics-section__title">
        <Lightbulb className="h-[14px] w-[14px]" />
        本期结论
        <span className="ml-auto text-[11px] font-normal text-muted-foreground/60">可直接执行</span>
      </div>
      {insights.length === 0 ? (
        <EmptyState title="还没有足够的结论" detail="继续收集访问数据后，这里会给出增长、风险和内容动作。" />
      ) : (
        <div className="analytics-insight-list">
          {insights.map((insight) => (
            <article key={insight.id} className={`analytics-insight ${toneClass[insight.tone]}`}>
              <div className="analytics-insight__marker" aria-hidden="true" />
              <div className="min-w-0">
                <div className="analytics-insight__title">{insight.title}</div>
                <p className="analytics-insight__description">{insight.description}</p>
                <p className="analytics-insight__action">{insight.action}</p>
              </div>
              {insight.metric ? <span className="analytics-insight__metric">{insight.metric}</span> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function KpiCard({ item }: { item: AnalyticsKpi }) {
  const positive = item.change >= 0;
  const TrendIcon = positive ? TrendingUp : TrendingDown;
  return (
    <article className="analytics-card analytics-card--kpi">
      <div className="flex items-center justify-between gap-[8px]">
        <span className="analytics-card__label">{item.label}</span>
        <span className={`analytics-delta ${positive ? "analytics-delta--up" : "analytics-delta--down"}`}>
          <TrendIcon className="h-[12px] w-[12px]" />
          {formatChange(item.change, item.changePercent)}
        </span>
      </div>
      <div className="analytics-card__value">
        {item.value}
        {item.unit ? <span className="analytics-card__unit">{item.unit}</span> : null}
      </div>
      <p className="analytics-card__explain">{item.interpretation}</p>
    </article>
  );
}

function TrendChart({ data }: { data: AnalyticsTrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 240;
  const PAD_T = 20;
  const PAD_B = 42;
  const PAD_X = 32;
  const innerH = H - PAD_T - PAD_B;
  const innerW = W - PAD_X * 2;
  const n = data.length;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const safeMax = Math.max(...data.map((d) => Math.max(d.count, d.previousCount)), 1);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: PAD_T + innerH * (1 - p),
    label: Math.round(safeMax * p),
  }));
  const point = (value: number, index: number) => ({
    x: PAD_X + (n > 1 ? step * index : innerW / 2),
    y: PAD_T + innerH * (1 - value / safeMax),
  });
  const current = data.map((d, i) => ({ ...point(d.count, i), value: d.count, date: d.date, isPeak: d.isPeak, isAnomaly: d.isAnomaly }));
  const previous = data.map((d, i) => ({ ...point(d.previousCount, i), value: d.previousCount }));
  const path = (points: { x: number; y: number }[]) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const currentPath = path(current);
  const previousPath = path(previous);

  return (
    <div className="px-[12px] sm:px-[16px] pt-[12px] pb-[8px]">
      <div className="mb-[8px] flex flex-wrap items-center gap-[12px] text-[11px] text-muted-foreground/70">
        <span className="analytics-legend"><span className="analytics-legend__line analytics-legend__line--current" />本期</span>
        <span className="analytics-legend"><span className="analytics-legend__line analytics-legend__line--previous" />对照期</span>
        <span className="analytics-legend"><span className="analytics-legend__dot" />峰值 / 异常</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none" role="img" aria-label="访问趋势与对照期折线图">
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={PAD_X} x2={W - PAD_X} y1={g.y} y2={g.y} stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.1} strokeDasharray={i === grid.length - 1 ? "0" : "3 4"} />
            <text x={PAD_X - 8} y={g.y + 3} textAnchor="end" className="fill-current opacity-40" fontSize="10" fontFamily="monospace">{g.label}</text>
          </g>
        ))}
        {previousPath ? <path d={previousPath} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth={1.6} strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {currentPath ? <path d={currentPath} fill="none" stroke="currentColor" strokeOpacity="0.86" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {current.map((p, i) => (
          <g key={p.date}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i || p.isPeak || p.isAnomaly ? 5 : 3}
              className={p.isAnomaly ? "analytics-chart-point analytics-chart-point--anomaly" : "analytics-chart-point"}
            />
            {p.isPeak || p.isAnomaly ? (
              <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-current opacity-80" fontSize="10" fontFamily="monospace">
                {p.isAnomaly ? "异常" : "峰值"}
              </text>
            ) : null}
          </g>
        ))}
        {current.map((p) => (
          <text key={`x-${p.date}`} x={p.x} y={H - PAD_B + 20} textAnchor="middle" className="fill-current opacity-45" fontSize="10" fontFamily="monospace">{p.date.slice(5)}</text>
        ))}
        {current.map((p, i) => {
          const width = step > 0 ? step : innerW;
          return (
            <rect
              key={`hit-${p.date}`}
              x={p.x - width / 2}
              y={PAD_T}
              width={width}
              height={innerH + 18}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${p.date}: 本期 ${p.value}，对照期 ${previous[i]?.value || 0}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function RankSection({ title, icon: Icon, items, empty }: {
  title: string;
  icon: typeof Globe;
  items: RankItem[];
  empty: string;
}) {
  const max = items.reduce((value, item) => Math.max(value, item.count), 1);
  return (
    <section className="analytics-section">
      <div className="analytics-section__title">
        <Icon className="h-[14px] w-[14px]" />
        {title}
      </div>
      <div className="analytics-list">
        {items.length === 0 ? (
          <div className="analytics-list__empty">{empty}</div>
        ) : (
          items.map((item) => (
            <div key={item.name} className="analytics-list__row analytics-list__row--stack">
              <div className="analytics-list__main">
                <span className="analytics-list__name analytics-list__name--wide">{item.name}</span>
                <span className="analytics-list__count">{item.count}</span>
              </div>
              <div className="analytics-list__bar-track" aria-hidden="true">
                <div className="analytics-list__bar-fill analytics-list__bar-fill--neutral" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
              <div className="analytics-list__meaning">
                {item.share !== undefined ? <span>{formatShare(item.share)}</span> : null}
                {item.meaning ? <span>{item.meaning}</span> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ContentSuggestions({ suggestions }: { suggestions: ContentSuggestion[] }) {
  return (
    <section className="analytics-section">
      <div className="analytics-section__title">
        <BookOpen className="h-[14px] w-[14px]" />
        内容建议
        <span className="ml-auto text-[11px] font-normal text-muted-foreground/60">置顶 / 内链 / 系列</span>
      </div>
      {suggestions.length === 0 ? (
        <EmptyState title="暂无可执行内容建议" detail="当页面访问形成排序后，会自动给出置顶、补内链和系列延展建议。" />
      ) : (
        <div className="analytics-suggestion-list">
          {suggestions.map((item) => (
            <article key={item.id} className="analytics-suggestion">
              <div className={`analytics-priority analytics-priority--${item.priority}`}>{item.priority}</div>
              <div className="min-w-0">
                <div className="analytics-suggestion__title">{item.title}</div>
                <p className="analytics-suggestion__reason">{item.reason}</p>
                <p className="analytics-suggestion__action">{item.action}</p>
              </div>
              {item.metric ? <span className="analytics-suggestion__metric">{item.metric}</span> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function sharesToRank(items: AnalyticsShareItem[]): RankItem[] {
  return items.map((item) => ({
    name: item.name,
    count: item.count,
    share: item.share,
    meaning: item.meaning,
  }));
}

function pageMatchesFilter(path: string, filter: PageFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "posts") return path.startsWith("/posts/");
  if (filter === "pages") return path.startsWith("/page/") || path === "/about" || path === "/privacy";
  if (filter === "search") return path.startsWith("/search");
  return !path.startsWith("/posts/") && !path.startsWith("/page/") && !path.startsWith("/search") && path !== "/about" && path !== "/privacy";
}

function PageFilterBar({ filters, value, onChange }: {
  filters: AnalyticsPageFilter[];
  value: PageFilterKey;
  onChange: (value: PageFilterKey) => void;
}) {
  return (
    <section className="analytics-section">
      <div className="analytics-section__title">
        <Filter className="h-[14px] w-[14px]" />
        页面筛选
        <span className="ml-auto text-[11px] font-normal text-muted-foreground/60">联动排行与建议</span>
      </div>
      <div className="analytics-filter-grid">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`analytics-filter ${value === item.key ? "analytics-filter--active" : ""}`}
          >
            <span className="analytics-filter__label">{item.label}</span>
            <span className="analytics-filter__value">{item.count}</span>
            <span className="analytics-filter__detail">{formatShare(item.share)} · {item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function LifecycleColumn({ title, items, empty }: {
  title: string;
  items: ContentLifecycleItem[];
  empty: string;
}) {
  return (
    <div className="analytics-lifecycle__column">
      <div className="analytics-lifecycle__heading">{title}</div>
      {items.length === 0 ? (
        <div className="analytics-lifecycle__empty">{empty}</div>
      ) : (
        items.map((item) => (
          <article key={`${item.stage}-${item.path}`} className="analytics-lifecycle__item">
            <div className="analytics-lifecycle__title">{item.title}</div>
            <div className="analytics-lifecycle__meta">
              <span>{item.count} 次访问</span>
              <span>{item.ageDays === null ? "未知年龄" : `${item.ageDays} 天`}</span>
              {typeof item.change === "number" ? <span>{item.change >= 0 ? "+" : ""}{item.change}</span> : null}
            </div>
            <p>{item.action}</p>
          </article>
        ))
      )}
    </div>
  );
}

function LifecycleSection({ lifecycle }: { lifecycle: AnalyticsData["derived"]["contentLifecycle"] }) {
  return (
    <section className="analytics-section">
      <div className="analytics-section__title">
        <FileText className="h-[14px] w-[14px]" />
        内容生命周期
        <span className="ml-auto text-[11px] font-normal text-muted-foreground/60">新文 / 增长 / 常青 / 衰退</span>
      </div>
      <div className="analytics-lifecycle">
        <LifecycleColumn title="新文观察" items={lifecycle.newPosts} empty="暂无 14 天内新文进入榜单" />
        <LifecycleColumn title="增长内容" items={lifecycle.growing} empty="暂无明显上升文章" />
        <LifecycleColumn title="常青内容" items={lifecycle.evergreen} empty="暂无长期稳定内容" />
        <LifecycleColumn title="待唤醒" items={lifecycle.declining} empty="暂无需要唤醒的文章" />
      </div>
    </section>
  );
}

function SearchDemandSection({ search }: { search: SearchAnalytics }) {
  return (
    <section className="analytics-section">
      <div className="analytics-section__title">
        <Search className="h-[14px] w-[14px]" />
        站内搜索需求
        <span className="ml-auto text-[11px] font-normal text-muted-foreground/60">
          零结果率 {(search.zeroResultRate * 100).toFixed(1)}%
        </span>
      </div>
      {search.status !== "tracked" ? (
        <EmptyState
          title={search.status === "empty" ? "暂无站内搜索数据" : "搜索埋点已准备"}
          detail="新部署后会记录搜索词、结果数量和零结果查询，积累后可直接反推选题。"
        />
      ) : (
        <div className="analytics-search-grid">
          <div>
            <div className="analytics-lifecycle__heading">热门搜索词</div>
            {search.topQueries.map((item) => (
              <div key={item.query} className="analytics-search-row">
                <span>{item.query}</span>
                <span>{item.count} 次 · 平均 {item.avgResults} 个结果</span>
              </div>
            ))}
          </div>
          <div>
            <div className="analytics-lifecycle__heading">零结果词</div>
            {search.zeroResultQueries.length === 0 ? (
              <div className="analytics-lifecycle__empty">暂无零结果搜索</div>
            ) : (
              search.zeroResultQueries.map((item) => (
                <div key={item.query} className="analytics-search-row">
                  <span>{item.query}</span>
                  <span>{item.count} 次</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ReportSection({ report }: { report: AnalyticsData["derived"]["report"] }) {
  return (
    <section className="analytics-section">
      <div className="analytics-section__title">
        <ClipboardList className="h-[14px] w-[14px]" />
        运营周报
        <span className="ml-auto text-[11px] font-normal text-muted-foreground/60">Markdown 可直接复盘</span>
      </div>
      <div className="analytics-report">
        <div>
          <div className="analytics-report__title">{report.title}</div>
          <p>{report.summary}</p>
          <div className="analytics-report__actions">
            {report.nextActions.length > 0 ? report.nextActions.map((item) => <span key={item}>{item}</span>) : <span>暂无明确动作</span>}
          </div>
        </div>
        <textarea readOnly value={report.markdown} aria-label="运营周报 Markdown" />
      </div>
    </section>
  );
}

function AnalyticsSourceStrip({ status, error }: { status: AEStatus; error: AEAnalyticsError | null }) {
  const detail = (() => {
    if (status === "ready") return "标准统计 + Cloudflare AE 高级维度";
    if (status === "loading") return "标准统计已启用，高级维度同步加载中";
    if (status === "unavailable") return error?.status === 501 ? "当前环境未启用 Cloudflare AE" : "Cloudflare AE 暂不可用";
    return "高级维度加载失败，标准统计仍可使用";
  })();

  return (
    <div className="mt-[20px] flex flex-col gap-[8px] rounded-md border border-border/60 bg-foreground/[0.025] px-[12px] py-[10px] text-[12px] text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-[8px]">
        <Cloud className="h-[14px] w-[14px] text-foreground/60" />
        <span className="font-medium text-foreground/75">数据源：运营洞察</span>
        <span>{detail}</span>
      </div>
      <span className="font-mono text-[11px] text-muted-foreground/50">
        {status === "ready" ? "AE READY" : status === "loading" ? "AE LOADING" : `AE ${error?.status ?? "OFF"}`}
      </span>
    </div>
  );
}

function AEAdvancedState({ status, error }: { status: AEStatus; error: AEAnalyticsError | null }) {
  if (status === "loading") {
    return (
      <section className="analytics-section">
        <div className="analytics-section__title">
          <Cloud className="h-[14px] w-[14px]" />
          Cloudflare 高级维度
        </div>
        <div className="p-[12px]">
          <div className="analytics-skeleton h-[96px]" />
        </div>
      </section>
    );
  }

  const title = status === "error" ? "高级维度加载失败" : "高级维度暂不可用";
  const detail = error?.status === 503
    ? "缺少 AE 读取凭据时，会先保留标准统计和内容建议。"
    : error?.status === 501
      ? "本地或非 Cloudflare 环境只展示标准统计。"
      : "标准统计、内容建议和运营周报仍可正常使用。";

  return (
    <section className="analytics-section">
      <div className="analytics-section__title">
        <Cloud className="h-[14px] w-[14px]" />
        Cloudflare 高级维度
      </div>
      <EmptyState title={title} detail={detail} />
    </section>
  );
}

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [aeData, setAeData] = useState<AEAnalyticsData | null>(null);
  const [aeStatus, setAeStatus] = useState<AEStatus>("loading");
  const [aeError, setAeError] = useState<AEAnalyticsError | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageFilter, setPageFilter] = useState<PageFilterKey>("all");

  useEffect(() => {
    document.title = "运营洞察 | Monolith";
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics(days)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch(() => {
        setData(null);
        setError("运营洞察数据加载失败，请稍后重试。");
      })
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    setAeStatus("loading");
    setAeData(null);
    setAeError(null);

    fetchAEAnalytics(days)
      .then((result) => {
        if (cancelled) return;
        setAeData(result);
        setAeStatus("ready");
      })
      .catch((err: AEAnalyticsError) => {
        if (cancelled) return;
        setAeData(null);
        setAeError(err);
        setAeStatus([401, 501, 503].includes(err.status) ? "unavailable" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-[16px] py-[24px] sm:px-[20px] sm:py-[36px]">
      <div className="mb-[28px]">
        <div className="flex flex-col gap-[14px] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-[8px] text-[22px] font-semibold tracking-[-0.02em]">
              <BarChart3 className="h-[20px] w-[20px] text-foreground/70" />
              运营洞察
            </h1>
            <p className="mt-[4px] text-[13px] text-muted-foreground/60">从流量、内容和受众结构里提取下一步动作。</p>
          </div>
          <div className="flex min-h-[44px] items-center gap-[4px] rounded-md border border-border/50 bg-foreground/[0.03] p-[4px]">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`min-h-[36px] rounded-md px-[12px] text-[12px] transition-colors ${
                  days === d ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>

        <AnalyticsSourceStrip status={aeStatus} error={aeError} />
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="analytics-error">
          <AlertTriangle className="h-[18px] w-[18px]" />
          {error}
        </div>
      ) : !data ? (
        <EmptyState title="暂无分析数据" detail="产生访问记录后，面板会自动生成结论和内容建议。" />
      ) : (
        <div className="space-y-[20px]">
          <ConclusionPanel insights={data.derived.insights} />
          <PageFilterBar filters={data.derived.pageFilters} value={pageFilter} onChange={setPageFilter} />

          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 lg:grid-cols-4">
            {data.derived.kpis.map((item) => (
              <KpiCard key={item.key} item={item} />
            ))}
          </div>

          <section className="analytics-section">
            <div className="analytics-section__title">
              <TrendingUp className="h-[14px] w-[14px]" />
              访问趋势与区间对比
              <span className="ml-auto text-[11px] font-normal text-muted-foreground/60">
                峰值 {Math.max(...data.derived.trend.map((item) => item.count), 0)} · 日均 {data.derived.period.average}
              </span>
            </div>
            {data.derived.trend.length === 0 ? (
              <EmptyState title="暂无趋势数据" detail="有访问后会显示本期、对照期、峰值和异常点。" />
            ) : (
              <TrendChart data={data.derived.trend} />
            )}
          </section>

          <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[1.05fr_0.95fr]">
            <ContentSuggestions suggestions={data.derived.contentSuggestions.filter((item) => !item.path || pageMatchesFilter(item.path, pageFilter))} />
            <section className="analytics-section">
              <div className="analytics-section__title">
                <MousePointer2 className="h-[14px] w-[14px]" />
                流量集中度
              </div>
              <div className="analytics-concentration">
                <div>
                  <div className="analytics-concentration__value">{formatShare(data.derived.concentration.topPageShare)}</div>
                  <div className="analytics-concentration__label">Top 页面占比</div>
                </div>
                <div>
                  <div className="analytics-concentration__value">{formatShare(data.derived.concentration.topRefererShare)}</div>
                  <div className="analytics-concentration__label">Top 来源占比</div>
                </div>
                <div>
                  <div className="analytics-concentration__value">{formatShare(data.derived.concentration.topDeviceShare)}</div>
                  <div className="analytics-concentration__label">Top 设备占比</div>
                </div>
                <p className="analytics-concentration__explain">
                  <CheckCircle2 className="h-[14px] w-[14px]" />
                  {data.derived.concentration.explanation}
                </p>
              </div>
            </section>
          </div>

          <LifecycleSection lifecycle={data.derived.contentLifecycle} />
          <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[0.9fr_1.1fr]">
            <SearchDemandSection search={data.derived.search} />
            <ReportSection report={data.derived.report} />
          </div>

          {aeData ? <AnalyticsAEAdvancedView data={aeData} /> : <AEAdvancedState status={aeStatus} error={aeError} />}

          <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
            <RankSection title="热门页面：排行与业务含义" icon={BookOpen} items={data.topPages.filter((item) => pageMatchesFilter(item.path, pageFilter)).map((item) => ({
              name: item.path,
              count: item.count,
              meaning: data.derived.topRisingPages.find((r) => r.path === item.path)?.change
                ? `环比 ${formatChange(data.derived.topRisingPages.find((r) => r.path === item.path)?.change || 0, data.derived.topRisingPages.find((r) => r.path === item.path)?.changePercent ?? null)}`
                : "稳定贡献内容入口",
            }))} empty="暂无页面访问数据" />
            <RankSection title="引荐来源：结构与风险" icon={ExternalLink} items={sharesToRank(data.derived.shares.referers)} empty="暂无引荐来源数据" />
            <RankSection title="设备类型：体验优先级" icon={Monitor} items={sharesToRank(data.derived.shares.devices)} empty="暂无设备数据" />
            <RankSection title="国家 / 地区：受众分布" icon={Globe} items={sharesToRank(data.derived.shares.countries)} empty="暂无地区数据" />
          </div>
        </div>
      )}
    </div>
  );
}
