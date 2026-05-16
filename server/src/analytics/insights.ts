type CountByDay = { date: string; count: number };
type CountByName<K extends string> = Record<K, string> & { count: number };

export type AnalyticsTone = "good" | "warning" | "danger" | "neutral";

export type AnalyticsInsight = {
  id: string;
  tone: AnalyticsTone;
  title: string;
  description: string;
  action: string;
  metric?: string;
  path?: string;
};

export type AnalyticsKpi = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  change: number;
  changePercent: number | null;
  interpretation: string;
};

export type AnalyticsTrendPoint = CountByDay & {
  previousCount: number;
  change: number;
  isPeak: boolean;
  isAnomaly: boolean;
};

export type AnalyticsShareItem = {
  name: string;
  count: number;
  share: number;
  meaning: string;
};

export type ContentSuggestion = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  reason: string;
  action: string;
  path?: string;
  metric?: string;
};

export type AnalyticsPageFilter = {
  key: "all" | "posts" | "pages" | "search" | "other";
  label: string;
  count: number;
  share: number;
  description: string;
};

export type ContentLifecycleItem = {
  path: string;
  title: string;
  count: number;
  ageDays: number | null;
  change?: number;
  stage: "new" | "growing" | "evergreen" | "declining";
  action: string;
};

export type SearchAnalytics = {
  status: "tracked" | "not_configured" | "empty";
  totalSearches: number;
  zeroResultRate: number;
  topQueries: { query: string; count: number; avgResults: number }[];
  zeroResultQueries: { query: string; count: number }[];
  suggestions: ContentSuggestion[];
};

export type OperationalReport = {
  title: string;
  summary: string;
  highlights: string[];
  nextActions: string[];
  markdown: string;
};

export type AnalyticsDerived = {
  period: {
    days: number;
    total: number;
    previousTotal: number;
    change: number;
    changePercent: number | null;
    average: number;
    previousAverage: number;
  };
  kpis: AnalyticsKpi[];
  trend: AnalyticsTrendPoint[];
  anomalies: AnalyticsInsight[];
  topRisingPages: { path: string; count: number; previousCount: number; change: number; changePercent: number | null }[];
  concentration: {
    topPageShare: number;
    topRefererShare: number;
    topDeviceShare: number;
    label: "healthy" | "watch" | "concentrated";
    explanation: string;
  };
  shares: {
    devices: AnalyticsShareItem[];
    referers: AnalyticsShareItem[];
    countries: AnalyticsShareItem[];
  };
  quality: {
    score: number;
    label: string;
    avgDuration?: number;
    bounceRate?: number;
    pagesPerVisitor?: number;
  };
  pageFilters: AnalyticsPageFilter[];
  contentLifecycle: {
    newPosts: ContentLifecycleItem[];
    growing: ContentLifecycleItem[];
    evergreen: ContentLifecycleItem[];
    declining: ContentLifecycleItem[];
  };
  search: SearchAnalytics;
  report: OperationalReport;
  insights: AnalyticsInsight[];
  contentSuggestions: ContentSuggestion[];
};

type BaseAnalytics = {
  visitsByDay: CountByDay[];
  topCountries: CountByName<"country">[];
  topReferers: CountByName<"referer">[];
  deviceBreakdown: CountByName<"device">[];
  topPages: CountByName<"path">[];
};

type BuildOptions = {
  days: number;
  previousVisitsByDay?: CountByDay[];
  previousTopPages?: CountByName<"path">[];
  posts?: { slug: string; title: string; createdAt: string; pinned?: boolean; category?: string; seriesSlug?: string | null }[];
  search?: SearchAnalytics;
  avgDuration?: number;
  bounceRate?: number;
  pagesPerVisitor?: number;
  uniqueVisitors?: number;
};

function sum(items: { count: number }[]): number {
  return items.reduce((total, item) => total + (Number(item.count) || 0), 0);
}

function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return (current - previous) / previous;
}

function formatPercent(value: number | null): string {
  if (value === null) return "新增基线";
  return `${value >= 0 ? "+" : ""}${Math.round(value * 100)}%`;
}

function shareItems<K extends string>(
  items: CountByName<K>[],
  key: K,
  total: number,
  fallback: string,
): AnalyticsShareItem[] {
  return items.map((item) => {
    const ratio = total > 0 ? item.count / total : 0;
    return {
      name: item[key] || fallback,
      count: Number(item.count) || 0,
      share: ratio,
      meaning: ratio >= 0.55 ? "流量高度集中，需要准备备用入口" : ratio >= 0.32 ? "主要贡献来源，适合继续放大" : "长尾补充，保持观察",
    };
  });
}

function rankRisingPages(
  current: CountByName<"path">[],
  previous: CountByName<"path">[] = [],
): AnalyticsDerived["topRisingPages"] {
  const previousMap = new Map(previous.map((item) => [item.path, Number(item.count) || 0]));
  return current
    .map((item) => {
      const previousCount = previousMap.get(item.path) || 0;
      const count = Number(item.count) || 0;
      return {
        path: item.path,
        count,
        previousCount,
        change: count - previousCount,
        changePercent: changePercent(count, previousCount),
      };
    })
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);
}

function trendWithSignals(current: CountByDay[], previous: CountByDay[]): AnalyticsTrendPoint[] {
  const max = current.reduce((value, item) => Math.max(value, Number(item.count) || 0), 0);
  const avg = current.length > 0 ? sum(current) / current.length : 0;
  const variance = current.length > 0
    ? current.reduce((total, item) => total + Math.pow((Number(item.count) || 0) - avg, 2), 0) / current.length
    : 0;
  const deviation = Math.sqrt(variance);

  return current.map((item, index) => {
    const count = Number(item.count) || 0;
    const previousCount = Number(previous[index]?.count) || 0;
    return {
      date: item.date,
      count,
      previousCount,
      change: count - previousCount,
      isPeak: max > 0 && count === max,
      isAnomaly: current.length >= 5 && deviation > 0 && Math.abs(count - avg) > deviation * 1.8,
    };
  });
}

function qualityScore(options: BuildOptions): AnalyticsDerived["quality"] {
  const durationScore = options.avgDuration ? Math.min(40, options.avgDuration / 3000) : 18;
  const bounceScore = typeof options.bounceRate === "number" ? Math.max(0, 30 - options.bounceRate * 30) : 15;
  const depthScore = options.pagesPerVisitor ? Math.min(30, options.pagesPerVisitor * 12) : 12;
  const score = Math.round(Math.max(0, Math.min(100, durationScore + bounceScore + depthScore)));
  const label = score >= 72 ? "阅读质量较好" : score >= 48 ? "阅读质量中性" : "阅读质量偏弱";
  return {
    score,
    label,
    avgDuration: options.avgDuration,
    bounceRate: options.bounceRate,
    pagesPerVisitor: options.pagesPerVisitor,
  };
}

function pageFilterKey(path: string): AnalyticsPageFilter["key"] {
  if (path.startsWith("/posts/")) return "posts";
  if (path.startsWith("/page/") || path === "/about" || path === "/privacy") return "pages";
  if (path.startsWith("/search")) return "search";
  return "other";
}

function buildPageFilters(topPages: CountByName<"path">[], total: number): AnalyticsPageFilter[] {
  const definitions: Record<AnalyticsPageFilter["key"], { label: string; description: string }> = {
    all: { label: "全部页面", description: "查看所有访问入口。" },
    posts: { label: "文章内容", description: "判断文章是否承担主要增长。" },
    pages: { label: "固定页面", description: "检查关于、友链等导航页表现。" },
    search: { label: "站内搜索", description: "观察搜索入口和搜索需求。" },
    other: { label: "其他入口", description: "首页、归档和系统页面。" },
  };
  const counts = new Map<AnalyticsPageFilter["key"], number>([
    ["all", sum(topPages)],
    ["posts", 0],
    ["pages", 0],
    ["search", 0],
    ["other", 0],
  ]);
  for (const page of topPages) {
    const key = pageFilterKey(page.path);
    counts.set(key, (counts.get(key) || 0) + (Number(page.count) || 0));
  }
  return (["all", "posts", "pages", "search", "other"] as const)
    .map((key) => ({
      key,
      label: definitions[key].label,
      count: counts.get(key) || 0,
      share: total > 0 ? (counts.get(key) || 0) / total : 0,
      description: definitions[key].description,
    }))
    .filter((item) => item.key === "all" || item.count > 0);
}

function buildLifecycle(
  topPages: CountByName<"path">[],
  rising: AnalyticsDerived["topRisingPages"],
  posts: BuildOptions["posts"] = [],
): AnalyticsDerived["contentLifecycle"] {
  const postMap = new Map(posts.map((post) => [post.slug, post]));
  const risingMap = new Map(rising.map((item) => [item.path, item]));
  const now = Date.now();
  const items = topPages
    .filter((page) => page.path.startsWith("/posts/"))
    .map<ContentLifecycleItem>((page) => {
      const slug = page.path.replace(/^\/posts\//, "");
      const post = postMap.get(slug);
      const ageDays = post?.createdAt ? Math.max(0, Math.floor((now - new Date(post.createdAt).getTime()) / 86400000)) : null;
      const risingItem = risingMap.get(page.path);
      const change = risingItem?.change || 0;
      const title = post?.title || page.path;
      if (ageDays !== null && ageDays <= 14) {
        return { path: page.path, title, count: page.count, ageDays, change, stage: "new", action: "观察首周表现，补充首页入口和相关推荐。" };
      }
      if (change > 0) {
        return { path: page.path, title, count: page.count, ageDays, change, stage: "growing", action: "继续写同主题系列，给它补上下游内链。" };
      }
      if (ageDays !== null && ageDays >= 90 && page.count > 0) {
        return { path: page.path, title, count: page.count, ageDays, change, stage: "evergreen", action: "更新发布时间、补示例和目录，维持长期搜索价值。" };
      }
      return { path: page.path, title, count: page.count, ageDays, change, stage: "declining", action: "检查标题摘要、入口位置和相关链接是否过期。" };
    });

  return {
    newPosts: items.filter((item) => item.stage === "new").slice(0, 5),
    growing: items.filter((item) => item.stage === "growing").slice(0, 5),
    evergreen: items.filter((item) => item.stage === "evergreen").slice(0, 5),
    declining: items.filter((item) => item.stage === "declining").slice(0, 5),
  };
}

function emptySearchAnalytics(): SearchAnalytics {
  return {
    status: "not_configured",
    totalSearches: 0,
    zeroResultRate: 0,
    topQueries: [],
    zeroResultQueries: [],
    suggestions: [
      {
        id: "search-tracking",
        priority: "medium",
        title: "站内搜索已准备埋点",
        reason: "新部署后会开始记录搜索词、结果数量和零结果查询。",
        action: "积累一段访问后，用零结果词补文章、标签或同义词入口。",
      },
    ],
  };
}

function buildReport(
  period: AnalyticsDerived["period"],
  insights: AnalyticsInsight[],
  contentSuggestions: ContentSuggestion[],
  quality: AnalyticsDerived["quality"],
  search: SearchAnalytics,
): OperationalReport {
  const highlights = insights.slice(0, 3).map((item) => `${item.title}：${item.description}`);
  const nextActions = [
    ...contentSuggestions.slice(0, 3).map((item) => item.action),
    search.zeroResultQueries[0] ? `补齐站内搜索零结果词「${search.zeroResultQueries[0].query}」对应内容或别名。` : "",
  ].filter(Boolean);
  const title = `${period.days} 天运营周报`;
  const summary = `本期 ${period.total} 次访问，较对照期 ${period.change >= 0 ? "增加" : "减少"} ${Math.abs(period.change)}，阅读质量 ${quality.score}/100。`;
  const markdown = [
    `## ${title}`,
    "",
    `- ${summary}`,
    `- 日均访问：${period.average}，对照期：${period.previousAverage}`,
    `- 搜索次数：${search.totalSearches}，零结果率：${Math.round(search.zeroResultRate * 100)}%`,
    "",
    "### 关键发现",
    ...highlights.map((item) => `- ${item}`),
    "",
    "### 下一步动作",
    ...(nextActions.length > 0 ? nextActions.map((item) => `- ${item}`) : ["- 暂无明确动作，继续观察数据积累。"]),
  ].join("\n");
  return { title, summary, highlights, nextActions, markdown };
}

export function attachAnalyticsInsights<T extends BaseAnalytics>(analytics: T, options: BuildOptions): T & { derived: AnalyticsDerived } {
  const total = sum(analytics.visitsByDay);
  const previousTotal = sum(options.previousVisitsByDay || []);
  const average = options.days > 0 ? Math.round(total / options.days) : 0;
  const previousAverage = options.days > 0 ? Math.round(previousTotal / options.days) : 0;
  const periodChange = total - previousTotal;
  const periodChangePercent = changePercent(total, previousTotal);
  const trend = trendWithSignals(analytics.visitsByDay, options.previousVisitsByDay || []);
  const anomalies = trend
    .filter((item) => item.isAnomaly)
    .slice(0, 3)
    .map<AnalyticsInsight>((item) => ({
      id: `anomaly-${item.date}`,
      tone: item.change >= 0 ? "warning" : "danger",
      title: `${item.date.slice(5)} 出现异常波动`,
      description: `当日访问 ${item.count}，较对照日 ${item.change >= 0 ? "增加" : "减少"} ${Math.abs(item.change)}。`,
      action: item.change >= 0 ? "复盘当天发布、外链或首页入口变化。" : "检查当天内容入口、站点可用性和索引状态。",
      metric: `${item.count}`,
    }));

  const topRefererTotal = sum(analytics.topReferers);
  const topDeviceTotal = sum(analytics.deviceBreakdown);
  const topPageShare = total > 0 ? (analytics.topPages[0]?.count || 0) / total : 0;
  const topRefererShare = total > 0 ? (analytics.topReferers[0]?.count || 0) / total : 0;
  const topDeviceShare = total > 0 ? (analytics.deviceBreakdown[0]?.count || 0) / total : 0;
  const concentrationLabel = topPageShare >= 0.5 || topRefererShare >= 0.6
    ? "concentrated"
    : topPageShare >= 0.32 || topRefererShare >= 0.4
      ? "watch"
      : "healthy";
  const topRisingPages = rankRisingPages(analytics.topPages, options.previousTopPages);
  const quality = qualityScore(options);
  const pageFilters = buildPageFilters(analytics.topPages, total);
  const contentLifecycle = buildLifecycle(analytics.topPages, topRisingPages, options.posts);
  const search = options.search || emptySearchAnalytics();

  const insights: AnalyticsInsight[] = [];
  insights.push({
    id: "period-change",
    tone: periodChange >= 0 ? "good" : "warning",
    title: periodChange >= 0 ? "本期访问保持增长" : "本期访问出现回落",
    description: `本期 ${total} 次访问，较对照期 ${periodChange >= 0 ? "增加" : "减少"} ${Math.abs(periodChange)}（${formatPercent(periodChangePercent)}）。`,
    action: periodChange >= 0 ? "把增长最高的页面前置到首页或导航入口。" : "优先检查首页入口、搜索收录和最近发布频率。",
    metric: `${periodChange >= 0 ? "+" : ""}${periodChange}`,
  });
  if (topRisingPages[0]) {
    insights.push({
      id: "rising-page",
      tone: "good",
      title: "有内容正在获得动能",
      description: `${topRisingPages[0].path} 是当前上升最明显的页面，贡献 ${topRisingPages[0].count} 次访问。`,
      action: "补充内链、更新摘要，并考虑在首页前置。",
      path: topRisingPages[0].path,
      metric: `${topRisingPages[0].change >= 0 ? "+" : ""}${topRisingPages[0].change}`,
    });
  }
  if (concentrationLabel !== "healthy") {
    insights.push({
      id: "concentration",
      tone: concentrationLabel === "concentrated" ? "warning" : "neutral",
      title: "流量入口存在集中趋势",
      description: `Top 页面占 ${(topPageShare * 100).toFixed(1)}%，Top 来源占 ${(topRefererShare * 100).toFixed(1)}%。`,
      action: "为高流量文章补同系列入口，同时给长尾内容增加相关推荐。",
    });
  }
  if (quality.score < 50) {
    insights.push({
      id: "quality",
      tone: "warning",
      title: "阅读深度需要关注",
      description: `${quality.label}，建议优先检查首屏信息和段落节奏。`,
      action: "给热门文章补目录、摘要和下一篇阅读入口。",
      metric: `${quality.score}/100`,
    });
  }
  for (const anomaly of anomalies) insights.push(anomaly);

  const contentSuggestions: ContentSuggestion[] = topRisingPages.slice(0, 4).map((item, index) => ({
    id: `content-${index}-${item.path}`,
    priority: index === 0 ? "high" : "medium",
    title: index === 0 ? "前置当前上升文章" : "延展已有访问动能",
    reason: `${item.path} 本期 ${item.count} 次访问，对照变化 ${item.change >= 0 ? "+" : ""}${item.change}。`,
    action: index === 0 ? "置顶、补首页入口或加入相关推荐。" : "补一条内链或继续写同主题系列。",
    path: item.path,
    metric: formatPercent(item.changePercent),
  }));

  if (analytics.topPages[0] && contentSuggestions.length < 5) {
    contentSuggestions.push({
      id: "content-top-page",
      priority: "medium",
      title: "维护最高访问页面",
      reason: `${analytics.topPages[0].path} 当前承担 ${(topPageShare * 100).toFixed(1)}% 访问。`,
      action: "检查标题、更新时间、目录和相关链接，避免流量只停留在单页。",
      path: analytics.topPages[0].path,
      metric: `${analytics.topPages[0].count}`,
    });
  }
  for (const suggestion of search.suggestions.slice(0, 2)) {
    if (contentSuggestions.length < 6) contentSuggestions.push(suggestion);
  }

  const period = {
    days: options.days,
    total,
    previousTotal,
    change: periodChange,
    changePercent: periodChangePercent,
    average,
    previousAverage,
  };
  const report = buildReport(period, insights, contentSuggestions, quality, search);

  const derived: AnalyticsDerived = {
    period,
    kpis: [
      {
        key: "visits",
        label: "总访问",
        value: total,
        change: periodChange,
        changePercent: periodChangePercent,
        interpretation: periodChange >= 0 ? "入口有效，继续放大增长页。" : "需要检查主要入口是否降权或断流。",
      },
      {
        key: "daily-average",
        label: "日均访问",
        value: average,
        change: average - previousAverage,
        changePercent: changePercent(average, previousAverage),
        interpretation: average >= previousAverage ? "日常访问节奏稳定。" : "发布节奏或推荐入口可能偏弱。",
      },
      {
        key: "sources",
        label: "引荐来源",
        value: analytics.topReferers.length,
        change: 0,
        changePercent: null,
        interpretation: analytics.topReferers.length > 3 ? "来源结构可继续拆分经营。" : "来源偏少，适合增加外链和搜索入口。",
      },
      {
        key: "quality",
        label: "阅读质量",
        value: quality.score,
        unit: "/100",
        change: 0,
        changePercent: null,
        interpretation: quality.label,
      },
    ],
    trend,
    anomalies,
    topRisingPages,
    concentration: {
      topPageShare,
      topRefererShare,
      topDeviceShare,
      label: concentrationLabel,
      explanation: concentrationLabel === "healthy"
        ? "页面和来源没有明显单点依赖。"
        : concentrationLabel === "watch"
          ? "有主要入口形成，需要同步扶持第二梯队。"
          : "流量高度依赖少数入口，应尽快分散风险。",
    },
    shares: {
      devices: shareItems(analytics.deviceBreakdown, "device", topDeviceTotal || total, "unknown"),
      referers: shareItems(analytics.topReferers, "referer", topRefererTotal || total, "direct"),
      countries: shareItems(analytics.topCountries, "country", sum(analytics.topCountries) || total, "XX"),
    },
    quality,
    pageFilters,
    contentLifecycle,
    search,
    report,
    insights: insights.slice(0, 5),
    contentSuggestions,
  };

  return { ...analytics, derived };
}
