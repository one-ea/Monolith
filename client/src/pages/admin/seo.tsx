import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { fetchAdminPosts, type Post } from "@/lib/api";
import { CheckCircle2, AlertTriangle, XCircle, FileText, Search, ExternalLink, RefreshCw, Edit, Sparkles } from "lucide-react";
import { buildOverview, type SeoOverview, type SeoCheckResult, type SiteInfraSignal } from "@/lib/seo-analyzer";

type FilterTab = "all" | "warn" | "poor" | "drafts";

function ScoreRing({ score, size = 140, stroke = 10, label }: { score: number; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = score >= 90 ? "stroke-emerald-400" : score >= 75 ? "stroke-cyan-400" : score >= 60 ? "stroke-amber-400" : "stroke-red-400";
  const colorBg = score >= 90 ? "text-emerald-400" : score >= 75 ? "text-cyan-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-[6px]">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border/20" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`} className={`${color} transition-all duration-700`}
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-[28px] font-bold leading-none tracking-tight ${colorBg}`}>{score}</span>
          <span className="text-[10px] text-muted-foreground/50 mt-[2px] font-medium">/ 100</span>
        </div>
      </div>
      <span className="text-[12px] text-muted-foreground/70 font-medium">{label}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: SeoCheckResult["status"] }) {
  if (status === "pass") return <CheckCircle2 className="h-[14px] w-[14px] text-emerald-400" />;
  if (status === "warn") return <AlertTriangle className="h-[14px] w-[14px] text-amber-400" />;
  return <XCircle className="h-[14px] w-[14px] text-red-400" />;
}

export function AdminSeo() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [sitemapPreview, setSitemapPreview] = useState<{ urls: string[]; raw: string } | null>(null);
  const [robotsPreview, setRobotsPreview] = useState<string>("");
  const [infra, setInfra] = useState<SiteInfraSignal>({});
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setRefreshing(true);
    setError(null);
    const [postsResult, smResult, rbResult, rssResult] = await Promise.allSettled([
      fetchAdminPosts(),
      fetch("/sitemap.xml").then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/robots.txt").then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/rss.xml", { method: "HEAD" }).then((r) => (r.ok ? true : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ]);

    if (postsResult.status === "fulfilled") {
      setPosts(postsResult.value);
    } else {
      setError(postsResult.reason instanceof Error ? postsResult.reason.message : "文章加载失败");
    }

    const nextInfra: SiteInfraSignal = {};
    if (smResult.status === "fulfilled") {
      const raw = smResult.value;
      const urls = Array.from(raw.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
      setSitemapPreview({ urls, raw });
      nextInfra.sitemap = { ok: true, urlCount: urls.length };
    } else {
      setSitemapPreview({ urls: [], raw: "" });
      nextInfra.sitemap = { ok: false, urlCount: 0, error: smResult.reason instanceof Error ? smResult.reason.message : "抓取失败" };
    }

    if (rbResult.status === "fulfilled") {
      const raw = rbResult.value;
      setRobotsPreview(raw);
      nextInfra.robots = { ok: true, hasSitemapDirective: /^\s*sitemap\s*:/im.test(raw) };
    } else {
      setRobotsPreview("");
      nextInfra.robots = { ok: false, hasSitemapDirective: false, error: rbResult.reason instanceof Error ? rbResult.reason.message : "抓取失败" };
    }

    nextInfra.rss = rssResult.status === "fulfilled"
      ? { ok: true }
      : { ok: false, error: rssResult.reason instanceof Error ? rssResult.reason.message : "抓取失败" };

    setInfra(nextInfra);
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    document.title = "SEO 优化 | Monolith";
    loadAll();
  }, []);

  const overview: SeoOverview = useMemo(() => {
    return buildOverview(posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      tags: p.tags,
      coverImage: p.coverImage,
      published: p.published,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })), infra);
  }, [posts, infra]);

  const filteredReports = useMemo(() => {
    let result = overview.postReports;
    if (tab === "drafts") {
      const draftSlugs = new Set(posts.filter((p) => !p.published).map((p) => p.slug));
      result = result.filter((r) => draftSlugs.has(r.slug));
    } else if (tab === "warn" || tab === "poor") {
      // warn / poor 只评估已发布文章，避免把待发草稿混入"待优化"统计
      const pubSlugs = new Set(posts.filter((p) => p.published).map((p) => p.slug));
      result = result.filter((r) => pubSlugs.has(r.slug));
      if (tab === "warn") result = result.filter((r) => r.totalScore >= 60 && r.totalScore < 90);
      else result = result.filter((r) => r.totalScore < 60);
    }
    // tab === "all": 不按发布状态过滤，真正展示全部文章
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
    }
    return result.sort((a, b) => a.totalScore - b.totalScore);
  }, [overview.postReports, posts, tab, search]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-[16px] py-[28px]">
        <div className="space-y-[16px]">
          <div className="h-[28px] w-[140px] bg-card/20 animate-pulse rounded" />
          <div className="grid grid-cols-5 gap-[12px]">
            {[...Array(5)].map((_, i) => (<div key={i} className="h-[160px] rounded-xl bg-card/10 animate-pulse" />))}
          </div>
          <div className="h-[300px] rounded-xl bg-card/10 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-[16px] py-[28px] space-y-[20px]">
      {/* ═══════════ 头部 ═══════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight flex items-center gap-[8px]">
            <Sparkles className="h-[20px] w-[20px] text-cyan-400" />
            SEO 优化
          </h1>
          <p className="text-[12px] text-muted-foreground/60 mt-[4px]">
            站点搜索引擎健康度全景，覆盖 Meta · 结构化 · 内容质量 · 可读性
          </p>
        </div>
        <button onClick={loadAll} disabled={refreshing}
          className="inline-flex items-center gap-[6px] h-[34px] px-[12px] rounded-lg border border-border/20 bg-card/10 text-[12px] font-medium hover:bg-card/20 transition-all disabled:opacity-50">
          <RefreshCw className={`h-[12px] w-[12px] ${refreshing ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-[8px] rounded-lg border border-red-400/30 bg-red-400/5 px-[12px] py-[10px]">
          <XCircle className="h-[14px] w-[14px] text-red-400 mt-[2px] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-red-400">数据加载失败</div>
            <div className="text-[11px] text-muted-foreground/70 mt-[2px] break-all">{error}</div>
          </div>
        </div>
      )}

      {/* ═══════════ 评分环组 ═══════════ */}
      <div className="rounded-xl border border-border/15 bg-card/5 p-[20px]">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-[16px] items-center">
          <div className="md:col-span-1 flex justify-center">
            <ScoreRing score={overview.totalScore} size={150} stroke={12} label="综合得分" />
          </div>
          <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-[12px]">
            <ScoreRing score={overview.dimensionScores.meta} size={100} stroke={8} label="Meta 元信息" />
            <ScoreRing score={overview.dimensionScores.structured} size={100} stroke={8} label="结构化数据" />
            <ScoreRing score={overview.dimensionScores.content} size={100} stroke={8} label="内容质量" />
            <ScoreRing score={overview.dimensionScores.readability} size={100} stroke={8} label="可读性" />
          </div>
        </div>

        {/* 分布趋势条 */}
        <div className="mt-[20px] pt-[16px] border-t border-border/10">
          <div className="flex items-center justify-between mb-[8px]">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/50 font-medium">已发布文章评分分布</span>
            <span className="text-[11px] text-muted-foreground/60">{overview.publishedPosts} 篇 · 草稿 {overview.draftPosts} 篇</span>
          </div>
          <div className="flex h-[10px] rounded-full overflow-hidden bg-card/20">
            {([
              ["excellent", overview.scoreDistribution.excellent, "bg-emerald-400/80", "≥90"],
              ["good", overview.scoreDistribution.good, "bg-cyan-400/80", "75-89"],
              ["warn", overview.scoreDistribution.warn, "bg-amber-400/80", "60-74"],
              ["poor", overview.scoreDistribution.poor, "bg-red-400/80", "<60"],
            ] as const).map(([k, v, c]) => (
              v > 0 && <div key={k} className={`${c} transition-all duration-700`} style={{ flex: v }} title={`${v} 篇`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-[12px] mt-[8px] text-[11px] text-muted-foreground/70">
            <span className="flex items-center gap-[5px]"><span className="w-[8px] h-[8px] rounded-full bg-emerald-400/80" />优秀 {overview.scoreDistribution.excellent}</span>
            <span className="flex items-center gap-[5px]"><span className="w-[8px] h-[8px] rounded-full bg-cyan-400/80" />良好 {overview.scoreDistribution.good}</span>
            <span className="flex items-center gap-[5px]"><span className="w-[8px] h-[8px] rounded-full bg-amber-400/80" />一般 {overview.scoreDistribution.warn}</span>
            <span className="flex items-center gap-[5px]"><span className="w-[8px] h-[8px] rounded-full bg-red-400/80" />待改 {overview.scoreDistribution.poor}</span>
          </div>
        </div>
      </div>

      {/* ═══════════ 全局基础设施检查 ═══════════ */}
      <div className="rounded-xl border border-border/15 bg-card/5 p-[16px]">
        <h2 className="text-[13px] font-semibold mb-[12px] flex items-center gap-[6px]">
          <FileText className="h-[14px] w-[14px] text-muted-foreground/60" />
          站点基础设施
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[8px]">
          {overview.globalChecks.map((c) => (
            <div key={c.id} className="flex items-start gap-[8px] rounded-lg border border-border/10 bg-card/5 p-[10px]">
              <StatusIcon status={c.status} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium leading-tight">{c.label}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-[2px] truncate">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ 文章健康表 ═══════════ */}
      <div className="rounded-xl border border-border/15 bg-card/5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[10px] p-[16px] border-b border-border/10">
          <h2 className="text-[13px] font-semibold flex items-center gap-[6px]">
            <FileText className="h-[14px] w-[14px] text-muted-foreground/60" />
            文章 SEO 健康表
          </h2>
          <div className="flex items-center gap-[6px]">
            <div className="flex rounded-lg border border-border/15 overflow-hidden text-[11px]">
              {([
                ["all", "全部"],
                ["warn", "待优化"],
                ["poor", "待改进"],
                ["drafts", "草稿"],
              ] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`px-[10px] h-[28px] font-medium transition-colors ${tab === k ? "bg-foreground text-background" : "bg-transparent hover:bg-card/20 text-muted-foreground/70"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-[8px] top-1/2 -translate-y-1/2 h-[12px] w-[12px] text-muted-foreground/40" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索标题/slug"
                className="h-[28px] w-[180px] rounded-lg border border-border/15 bg-card/10 pl-[28px] pr-[10px] text-[11px] outline-none focus:border-cyan-400/50" />
            </div>
          </div>
        </div>
        {filteredReports.length === 0 ? (
          <div className="py-[40px] text-center text-[12px] text-muted-foreground/50">没有符合条件的文章</div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto overscroll-contain scrollbar-thin">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-card/40 backdrop-blur-sm z-10">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  <th className="text-left font-medium py-[8px] px-[12px] w-[60px]">分</th>
                  <th className="text-left font-medium py-[8px] px-[12px]">标题</th>
                  <th className="text-left font-medium py-[8px] px-[12px] w-[120px]">通过</th>
                  <th className="text-left font-medium py-[8px] px-[12px] w-[80px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r) => {
                  const failed = r.checks.filter((c) => c.status !== "pass");
                  const scoreClass = r.totalScore >= 90 ? "text-emerald-400 bg-emerald-400/10" : r.totalScore >= 75 ? "text-cyan-400 bg-cyan-400/10" : r.totalScore >= 60 ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10";
                  return (
                    <tr key={r.slug} className="border-t border-border/10 hover:bg-card/10 transition-colors">
                      <td className="py-[10px] px-[12px]">
                        <span className={`inline-flex items-center justify-center min-w-[36px] h-[24px] rounded-md text-[12px] font-bold tabular-nums ${scoreClass}`}>{r.totalScore}</span>
                      </td>
                      <td className="py-[10px] px-[12px]">
                        <div className="font-medium text-[12px] truncate max-w-[420px]">{r.title}</div>
                        {failed.length > 0 && (
                          <div className="flex flex-wrap gap-[4px] mt-[4px]">
                            {failed.slice(0, 4).map((f) => (
                              <span key={f.id} className="inline-flex items-center gap-[3px] text-[10px] px-[5px] py-[1px] rounded bg-card/30 text-muted-foreground/70" title={f.detail}>
                                <StatusIcon status={f.status} />{f.label}
                              </span>
                            ))}
                            {failed.length > 4 && <span className="text-[10px] text-muted-foreground/50">+{failed.length - 4}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-[10px] px-[12px] tabular-nums text-muted-foreground/70">{r.passedCount} / {r.totalCount}</td>
                      <td className="py-[10px] px-[12px]">
                        <div className="flex items-center gap-[6px]">
                          <Link href={`/admin/editor/${r.slug}`} className="text-muted-foreground/60 hover:text-foreground transition-colors" title="编辑">
                            <Edit className="h-[12px] w-[12px]" />
                          </Link>
                          <a href={`/posts/${r.slug}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 hover:text-foreground transition-colors" title="访问">
                            <ExternalLink className="h-[12px] w-[12px]" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════ 关键词云 ═══════════ */}
      {overview.topKeywords.length > 0 && (
        <div className="rounded-xl border border-border/15 bg-card/5 p-[16px]">
          <h2 className="text-[13px] font-semibold mb-[12px] flex items-center gap-[6px]">
            <Sparkles className="h-[14px] w-[14px] text-muted-foreground/60" />
            关键词密度云
            <span className="text-[10px] text-muted-foreground/50 font-normal ml-[4px]">基于已发布文章 title + tags + 首段</span>
          </h2>
          <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[4px]">
            {overview.topKeywords.map((k) => {
              const fontSize = 11 + Math.round(k.weight * 14);
              const opacity = 0.45 + k.weight * 0.55;
              return (
                <span key={k.word} style={{ fontSize: `${fontSize}px`, opacity }}
                  className="font-medium text-foreground hover:text-cyan-400 transition-colors cursor-default" title={`${k.count} 次`}>
                  {k.word}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ Sitemap / Robots 预览 ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[12px]">
        <div className="rounded-xl border border-border/15 bg-card/5">
          <div className="flex items-center justify-between p-[12px] border-b border-border/10">
            <h2 className="text-[12px] font-semibold flex items-center gap-[6px]">
              <FileText className="h-[12px] w-[12px] text-muted-foreground/60" />
              Sitemap.xml
              {sitemapPreview && <span className="text-[10px] text-muted-foreground/50 font-normal">{sitemapPreview.urls.length} URLs</span>}
            </h2>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 hover:text-foreground transition-colors" title="新窗口打开">
              <ExternalLink className="h-[12px] w-[12px]" />
            </a>
          </div>
          <div className="max-h-[260px] overflow-y-auto overscroll-contain scrollbar-thin p-[10px] space-y-[2px]">
            {sitemapPreview?.urls.length ? (
              sitemapPreview.urls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer"
                  className="block text-[11px] font-mono text-muted-foreground/70 hover:text-cyan-400 truncate transition-colors">
                  {u}
                </a>
              ))
            ) : (
              <div className="text-[11px] text-muted-foreground/50 py-[12px] text-center">未抓取到 URL</div>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border/15 bg-card/5">
          <div className="flex items-center justify-between p-[12px] border-b border-border/10">
            <h2 className="text-[12px] font-semibold flex items-center gap-[6px]">
              <FileText className="h-[12px] w-[12px] text-muted-foreground/60" />
              Robots.txt
            </h2>
            <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 hover:text-foreground transition-colors" title="新窗口打开">
              <ExternalLink className="h-[12px] w-[12px]" />
            </a>
          </div>
          <pre className="max-h-[260px] overflow-y-auto overscroll-contain scrollbar-thin p-[10px] text-[11px] font-mono text-muted-foreground/80 whitespace-pre-wrap leading-[1.6]">
            {robotsPreview || "未拉取到 robots.txt"}
          </pre>
        </div>
      </div>
    </div>
  );
}
