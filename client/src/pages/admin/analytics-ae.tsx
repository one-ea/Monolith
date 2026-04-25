import { useState, useEffect } from "react";
import { fetchAEAnalytics, type AEAnalyticsData, type AEAnalyticsError } from "@/lib/api";
import { Globe, Monitor, ExternalLink, Cloud, Users, Clock, Languages, MonitorSmartphone } from "lucide-react";

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

  const maxDay = Math.max(...data.visitsByDay.map((d) => d.count), 1);

  return (
    <div className="space-y-[20px]">
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
      </div>

      <div className="analytics-section">
        <h2 className="analytics-section__title">
          <Users className="h-[14px] w-[14px]" />
          访问趋势 (PV / UV)
        </h2>
        <div className="analytics-chart">
          {data.visitsByDay.length === 0 ? (
            <div className="text-center text-muted-foreground/30 py-[40px] text-[12px]">暂无访问数据</div>
          ) : (
            <div className="analytics-chart__bars">
              {data.visitsByDay.map((day) => (
                <div key={day.date} className="analytics-chart__col">
                  <div className="analytics-chart__bar-wrapper">
                    <div
                      className="analytics-chart__bar"
                      style={{ height: `${(day.count / maxDay) * 100}%` }}
                    />
                  </div>
                  <span className="analytics-chart__label">{day.date.slice(5)}</span>
                  <span className="analytics-chart__count">{day.count} / {day.uv}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
          title="引荐来源"
          icon={ExternalLink}
          accent="violet"
          mono
          items={data.topReferers.map((i) => ({ name: i.referer, count: i.count }))}
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
