import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { fetchAdminPosts, updatePost, getToken, type Post } from "@/lib/api";
import { AlertTriangle, CheckCircle2, ClipboardList, Edit, ExternalLink, FileText, Globe, Image, RefreshCw, Save, Search, Sparkles, Wand2, XCircle } from "lucide-react";
import { buildOverview, extractKeywords, stripMarkdown, type PostSeoReport, type SeoCheckResult, type SeoOverview, type SiteInfraSignal } from "@/lib/seo-analyzer";

type FilterTab = "all" | "warn" | "poor" | "drafts";

type SeoSettings = {
  site_title: string;
  site_description: string;
  site_tagline: string;
  site_og_image: string;
  rss_enabled: string;
  custom_header: string;
  custom_footer: string;
};

type QuickDraft = {
  title: string;
  slug: string;
  excerpt: string;
  tags: string;
  coverImage: string;
};

const defaultSeoSettings: SeoSettings = {
  site_title: "Monolith",
  site_description: "",
  site_tagline: "",
  site_og_image: "",
  rss_enabled: "true",
  custom_header: "",
  custom_footer: "",
};

function scoreTone(score: number) {
  if (score >= 90) return "text-foreground bg-foreground/10 border-border/30";
  if (score >= 75) return "text-foreground/78 bg-foreground/[0.06] border-border/20";
  if (score >= 60) return "text-amber-400 bg-amber-400/10 border-amber-400/20";
  return "text-red-400 bg-red-400/10 border-red-400/20";
}

function ScoreRing({ score, size = 136, stroke = 10, label }: { score: number; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const strokeColor = score >= 75 ? "stroke-foreground/78" : score >= 60 ? "stroke-amber-400" : "stroke-red-400";
  const textColor = score >= 75 ? "text-foreground" : score >= 60 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-[8px]">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border/22" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className={`${strokeColor} transition-all duration-700`}
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-heading text-[28px] font-bold leading-none tracking-[-0.03em] ${textColor}`}>{score}</span>
          <span className="mt-[2px] text-[10px] font-medium text-muted-foreground/50">/ 100</span>
        </div>
      </div>
      <span className="text-[12px] font-medium text-muted-foreground/70">{label}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: SeoCheckResult["status"] }) {
  if (status === "pass") return <CheckCircle2 className="h-[14px] w-[14px] text-foreground/70" />;
  if (status === "warn") return <AlertTriangle className="h-[14px] w-[14px] text-amber-400" />;
  return <XCircle className="h-[14px] w-[14px] text-red-400" />;
}

function normalizeSettings(input: Record<string, string>): SeoSettings {
  return {
    ...defaultSeoSettings,
    ...input,
  };
}

function draftFromPost(post: Post): QuickDraft {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || "",
    tags: post.tags.join(", "),
    coverImage: post.coverImage || "",
  };
}

function buildExcerpt(content: string) {
  return stripMarkdown(content).slice(0, 156);
}

function pickKeywords(post: Post) {
  const keywords = Array.from(extractKeywords(`${post.title} ${post.content}`).entries())
    .filter(([word]) => word.length >= 2 && word.length <= 12)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .filter((word) => !post.tags.includes(word));
  return keywords.slice(0, Math.max(0, 3 - post.tags.length));
}

function SettingsField({ label, value, onChange, placeholder, multiline, mono, hint }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/45">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`settings-input resize-y py-[10px] leading-[1.6] ${mono ? "font-mono text-[12px]" : ""}`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`settings-input h-[40px] ${mono ? "font-mono text-[12px]" : ""}`}
        />
      )}
      {hint ? <span className="mt-[6px] block text-[11px] leading-[1.5] text-muted-foreground/40">{hint}</span> : null}
    </label>
  );
}

function ActionQueue({ reports, onSelect }: { reports: PostSeoReport[]; onSelect: (slug: string) => void }) {
  const actions = reports
    .flatMap((report) => report.checks
      .filter((check) => check.status !== "pass")
      .slice(0, 3)
      .map((check) => ({ report, check })))
    .slice(0, 6);

  return (
    <section className="rounded-md border border-border/20 bg-card/5 p-[14px]">
      <div className="mb-[10px] flex items-center gap-[8px]">
        <ClipboardList className="h-[14px] w-[14px] text-muted-foreground/60" />
        <h2 className="text-[13px] font-semibold">本轮可执行事项</h2>
      </div>
      {actions.length === 0 ? (
        <div className="rounded-md border border-border/14 bg-background/25 px-[12px] py-[18px] text-[12px] text-muted-foreground/55">
          暂无高优先级修复项。
        </div>
      ) : (
        <div className="grid gap-[8px]">
          {actions.map(({ report, check }) => (
            <button
              key={`${report.slug}-${check.id}`}
              type="button"
              onClick={() => onSelect(report.slug)}
              className="grid gap-[6px] rounded-md border border-border/14 bg-background/25 px-[12px] py-[10px] text-left transition-colors hover:bg-card/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-center justify-between gap-[10px]">
                <span className="truncate text-[12px] font-medium text-foreground/85">{report.title}</span>
                <span className={`rounded-md border px-[6px] py-[2px] font-mono text-[10px] ${scoreTone(report.totalScore)}`}>{report.totalScore}</span>
              </div>
              <div className="flex items-center gap-[6px] text-[11px] text-muted-foreground/60">
                <StatusIcon status={check.status} />
                <span>{check.label}</span>
                <span className="truncate">{check.detail}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminSeo() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState<SeoSettings>(defaultSeoSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [postSaving, setPostSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" as "" | "success" | "error" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [draft, setDraft] = useState<QuickDraft | null>(null);
  const [sitemapPreview, setSitemapPreview] = useState<{ urls: string[]; raw: string } | null>(null);
  const [robotsPreview, setRobotsPreview] = useState("");
  const [infra, setInfra] = useState<SiteInfraSignal>({});
  const [error, setError] = useState<string | null>(null);

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  };

  const loadAll = async () => {
    setRefreshing(true);
    setError(null);
    const [postsResult, settingsResult, smResult, rbResult, rssResult] = await Promise.allSettled([
      fetchAdminPosts(),
      fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => (r.ok ? r.json() as Promise<Record<string, string>> : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/sitemap.xml").then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/robots.txt").then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch("/rss.xml", { method: "HEAD" }).then((r) => (r.ok ? true : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ]);

    if (postsResult.status === "fulfilled") {
      setPosts(postsResult.value);
      if (!selectedSlug && postsResult.value.length > 0) {
        const first = postsResult.value[0];
        setSelectedSlug(first.slug);
        setDraft(draftFromPost(first));
      }
    } else {
      setError(postsResult.reason instanceof Error ? postsResult.reason.message : "文章加载失败");
    }

    if (settingsResult.status === "fulfilled") {
      setSettings(normalizeSettings(settingsResult.value));
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
    document.title = "搜索优化 | Monolith";
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

  const selectedPost = useMemo(() => posts.find((post) => post.slug === selectedSlug) || null, [posts, selectedSlug]);
  const selectedReport = useMemo(() => overview.postReports.find((report) => report.slug === selectedSlug) || null, [overview.postReports, selectedSlug]);

  const filteredReports = useMemo(() => {
    let result = overview.postReports;
    if (tab === "drafts") {
      const draftSlugs = new Set(posts.filter((p) => !p.published).map((p) => p.slug));
      result = result.filter((r) => draftSlugs.has(r.slug));
    } else if (tab === "warn" || tab === "poor") {
      const pubSlugs = new Set(posts.filter((p) => p.published).map((p) => p.slug));
      result = result.filter((r) => pubSlugs.has(r.slug));
      if (tab === "warn") result = result.filter((r) => r.totalScore >= 60 && r.totalScore < 90);
      else result = result.filter((r) => r.totalScore < 60);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
    }
    return result.sort((a, b) => a.totalScore - b.totalScore);
  }, [overview.postReports, posts, tab, search]);

  const selectPost = (slug: string) => {
    const post = posts.find((item) => item.slug === slug);
    if (!post) return;
    setSelectedSlug(slug);
    setDraft(draftFromPost(post));
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("保存失败");
      showMsg("全站 SEO 设置已保存", "success");
      await loadAll();
    } catch {
      showMsg("全站 SEO 设置保存失败", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  const savePost = async () => {
    if (!selectedPost || !draft) return;
    setPostSaving(true);
    try {
      const tags = draft.tags.split(",").map((item) => item.trim()).filter(Boolean);
      const updated = await updatePost(selectedPost.slug, {
        title: draft.title.trim(),
        slug: draft.slug.trim(),
        excerpt: draft.excerpt.trim(),
        coverImage: draft.coverImage.trim(),
        tags,
      });
      setPosts((prev) => prev.map((post) => post.slug === selectedPost.slug ? updated : post));
      setSelectedSlug(updated.slug);
      setDraft(draftFromPost(updated));
      showMsg("文章 SEO 字段已保存", "success");
    } catch {
      showMsg("文章 SEO 字段保存失败", "error");
    } finally {
      setPostSaving(false);
    }
  };

  const applyAutoFixes = () => {
    if (!selectedPost || !draft) return;
    const next = { ...draft };
    if (!next.excerpt.trim() || next.excerpt.trim().length < 60) next.excerpt = buildExcerpt(selectedPost.content);
    if (!next.coverImage.trim() && settings.site_og_image.trim()) next.coverImage = settings.site_og_image.trim();
    const tags = next.tags.split(",").map((item) => item.trim()).filter(Boolean);
    const additions = pickKeywords({ ...selectedPost, tags });
    next.tags = Array.from(new Set([...tags, ...additions])).slice(0, 5).join(", ");
    setDraft(next);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-[16px] py-[28px]">
        <div className="space-y-[16px]">
          <div className="h-[28px] w-[140px] animate-pulse rounded-md bg-card/20" />
          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
            {[...Array(3)].map((_, index) => <div key={index} className="h-[160px] animate-pulse rounded-md bg-card/10" />)}
          </div>
          <div className="h-[360px] animate-pulse rounded-md bg-card/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-[16px] py-[28px] space-y-[20px]">
      <div className="flex flex-col gap-[14px] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-[8px] text-[22px] font-bold leading-tight tracking-[-0.02em]">
            <Sparkles className="h-[20px] w-[20px] text-foreground/72" />
            搜索优化
          </h1>
          <p className="mt-[4px] text-[12px] text-muted-foreground/60">
            站点搜索健康度、全局 Meta、文章摘要、标签和分享图都可在这里直接修正。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          {message.text ? (
            <span className={`rounded-md border px-[10px] py-[7px] text-[12px] ${message.type === "success" ? "border-border/30 bg-foreground/8 text-foreground" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>
              {message.text}
            </span>
          ) : null}
          <button
            type="button"
            onClick={loadAll}
            disabled={refreshing}
            className="inline-flex min-h-[40px] items-center gap-[6px] rounded-md border border-border/25 bg-card/10 px-[12px] text-[12px] font-medium transition-all hover:bg-card/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-[12px] w-[12px] ${refreshing ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-[8px] rounded-md border border-red-400/30 bg-red-400/5 px-[12px] py-[10px]">
          <XCircle className="mt-[2px] h-[14px] w-[14px] shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-red-400">数据加载失败</div>
            <div className="mt-[2px] break-all text-[11px] text-muted-foreground/70">{error}</div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-[16px]">
          <section className="rounded-md border border-border/20 bg-card/5 p-[16px]">
            <div className="grid grid-cols-1 items-center gap-[16px] md:grid-cols-[180px_minmax(0,1fr)]">
              <ScoreRing score={overview.totalScore} size={150} stroke={12} label="综合得分" />
              <div className="grid grid-cols-2 gap-[12px] lg:grid-cols-4">
                <ScoreRing score={overview.dimensionScores.meta} size={96} stroke={8} label="Meta 元信息" />
                <ScoreRing score={overview.dimensionScores.structured} size={96} stroke={8} label="结构化数据" />
                <ScoreRing score={overview.dimensionScores.content} size={96} stroke={8} label="内容质量" />
                <ScoreRing score={overview.dimensionScores.readability} size={96} stroke={8} label="可读性" />
              </div>
            </div>

            <div className="mt-[18px] border-t border-border/12 pt-[14px]">
              <div className="mb-[8px] flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground/50">已发布文章评分分布</span>
                <span className="text-[11px] text-muted-foreground/60">{overview.publishedPosts} 篇 · 草稿 {overview.draftPosts} 篇</span>
              </div>
              <div className="flex h-[10px] overflow-hidden rounded-full bg-card/20">
                {([
                  ["excellent", overview.scoreDistribution.excellent, "bg-foreground/78"],
                  ["good", overview.scoreDistribution.good, "bg-foreground/48"],
                  ["warn", overview.scoreDistribution.warn, "bg-amber-400/80"],
                  ["poor", overview.scoreDistribution.poor, "bg-red-400/80"],
                ] as const).map(([key, value, color]) => (
                  value > 0 ? <div key={key} className={`${color} transition-all duration-700`} style={{ flex: value }} title={`${value} 篇`} /> : null
                ))}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-[12px] lg:grid-cols-[0.82fr_1.18fr]">
            <section className="rounded-md border border-border/20 bg-card/5 p-[14px]">
              <h2 className="mb-[12px] flex items-center gap-[6px] text-[13px] font-semibold">
                <Globe className="h-[14px] w-[14px] text-muted-foreground/60" />
                站点基础设施
              </h2>
              <div className="grid gap-[8px] sm:grid-cols-2 lg:grid-cols-1">
                {overview.globalChecks.map((check) => (
                  <div key={check.id} className="flex items-start gap-[8px] rounded-md border border-border/12 bg-background/25 p-[10px]">
                    <StatusIcon status={check.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium leading-tight">{check.label}</div>
                      <div className="mt-[2px] truncate text-[10px] text-muted-foreground/60">{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <ActionQueue reports={overview.postReports.filter((report) => posts.find((post) => post.slug === report.slug)?.published)} onSelect={selectPost} />
          </div>

          <section className="rounded-md border border-border/20 bg-card/5">
            <div className="flex flex-col gap-[10px] border-b border-border/12 p-[14px] sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-[6px] text-[13px] font-semibold">
                <FileText className="h-[14px] w-[14px] text-muted-foreground/60" />
                文章 SEO 工作队列
              </h2>
              <div className="flex flex-wrap items-center gap-[6px]">
                <div className="flex overflow-hidden rounded-md border border-border/20 text-[11px]">
                  {([
                    ["all", "全部"],
                    ["warn", "待优化"],
                    ["poor", "待改进"],
                    ["drafts", "草稿"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`min-h-[32px] px-[10px] font-medium transition-colors ${tab === key ? "bg-foreground text-background" : "bg-transparent text-muted-foreground/70 hover:bg-card/20"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-[8px] top-1/2 h-[12px] w-[12px] -translate-y-1/2 text-muted-foreground/40" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索标题/slug"
                    className="settings-input h-[36px] w-[190px] pl-[28px] text-[12px]"
                  />
                </div>
              </div>
            </div>
            {filteredReports.length === 0 ? (
              <div className="py-[40px] text-center text-[12px] text-muted-foreground/50">没有符合条件的文章</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto overscroll-contain scrollbar-thin">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm">
                    <tr className="text-[10px] uppercase tracking-normal text-muted-foreground/50">
                      <th className="w-[64px] px-[12px] py-[8px] text-left font-medium">分</th>
                      <th className="px-[12px] py-[8px] text-left font-medium">标题</th>
                      <th className="w-[120px] px-[12px] py-[8px] text-left font-medium">通过</th>
                      <th className="w-[96px] px-[12px] py-[8px] text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => {
                      const failed = report.checks.filter((check) => check.status !== "pass");
                      const active = report.slug === selectedSlug;
                      return (
                        <tr key={report.slug} className={`border-t border-border/10 transition-colors hover:bg-card/10 ${active ? "bg-foreground/[0.04]" : ""}`}>
                          <td className="px-[12px] py-[10px]">
                            <span className={`inline-flex h-[24px] min-w-[36px] items-center justify-center rounded-md border text-[12px] font-bold tabular-nums ${scoreTone(report.totalScore)}`}>{report.totalScore}</span>
                          </td>
                          <td className="px-[12px] py-[10px]">
                            <button type="button" onClick={() => selectPost(report.slug)} className="block max-w-[460px] truncate text-left text-[12px] font-medium text-foreground/88 hover:text-foreground">
                              {report.title}
                            </button>
                            {failed.length > 0 ? (
                              <div className="mt-[5px] flex flex-wrap gap-[4px]">
                                {failed.slice(0, 4).map((check) => (
                                  <span key={check.id} className="inline-flex items-center gap-[3px] rounded-md bg-card/30 px-[5px] py-[1px] text-[10px] text-muted-foreground/70" title={check.detail}>
                                    <StatusIcon status={check.status} />{check.label}
                                  </span>
                                ))}
                                {failed.length > 4 ? <span className="text-[10px] text-muted-foreground/50">+{failed.length - 4}</span> : null}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-[12px] py-[10px] tabular-nums text-muted-foreground/70">{report.passedCount} / {report.totalCount}</td>
                          <td className="px-[12px] py-[10px]">
                            <div className="flex items-center gap-[8px]">
                              <button type="button" onClick={() => selectPost(report.slug)} className="text-muted-foreground/60 transition-colors hover:text-foreground" title="快速修复">
                                <Wand2 className="h-[13px] w-[13px]" />
                              </button>
                              <Link href={`/admin/editor/${report.slug}`} className="text-muted-foreground/60 transition-colors hover:text-foreground" title="完整编辑">
                                <Edit className="h-[13px] w-[13px]" />
                              </Link>
                              <a href={`/posts/${report.slug}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 transition-colors hover:text-foreground" title="访问">
                                <ExternalLink className="h-[13px] w-[13px]" />
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
          </section>

          {overview.topKeywords.length > 0 ? (
            <section className="rounded-md border border-border/20 bg-card/5 p-[14px]">
              <h2 className="mb-[12px] flex items-center gap-[6px] text-[13px] font-semibold">
                <Sparkles className="h-[14px] w-[14px] text-muted-foreground/60" />
                关键词密度云
                <span className="ml-[4px] text-[10px] font-normal text-muted-foreground/50">基于已发布文章 title + tags + 首段</span>
              </h2>
              <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[4px]">
                {overview.topKeywords.map((keyword) => {
                  const fontSize = 11 + Math.round(keyword.weight * 14);
                  const opacity = 0.45 + keyword.weight * 0.55;
                  return (
                    <span key={keyword.word} style={{ fontSize: `${fontSize}px`, opacity }} className="cursor-default font-medium text-foreground" title={`${keyword.count} 次`}>
                      {keyword.word}
                    </span>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-[16px] xl:sticky xl:top-[72px] xl:self-start">
          <section className="rounded-md border border-border/20 bg-card/5 p-[14px]">
            <div className="mb-[12px] flex items-center justify-between gap-[12px]">
              <div>
                <h2 className="flex items-center gap-[6px] text-[13px] font-semibold">
                  <Globe className="h-[14px] w-[14px] text-muted-foreground/60" />
                  全站 SEO 设置
                </h2>
                <p className="mt-[3px] text-[11px] text-muted-foreground/50">直接写入站点配置，影响首页 SEO、分享卡片和 RSS。</p>
              </div>
              <button
                type="button"
                onClick={saveSettings}
                disabled={settingsSaving}
                className="inline-flex min-h-[36px] items-center gap-[6px] rounded-md bg-foreground px-[10px] text-[12px] font-medium text-background disabled:opacity-50"
              >
                <Save className="h-[12px] w-[12px]" />
                保存
              </button>
            </div>
            <div className="space-y-[12px]">
              <SettingsField label="站点标题" value={settings.site_title} onChange={(value) => setSettings((prev) => ({ ...prev, site_title: value }))} placeholder="Monolith" />
              <SettingsField label="默认描述" value={settings.site_description} onChange={(value) => setSettings((prev) => ({ ...prev, site_description: value }))} placeholder="建议 80-160 字" multiline hint={`${settings.site_description.length} 字符，首页 description 和分享摘要会读取这里。`} />
              <SettingsField label="分享图 URL" value={settings.site_og_image} onChange={(value) => setSettings((prev) => ({ ...prev, site_og_image: value }))} placeholder="https://example.com/og.png" mono />
              <div className="flex items-center justify-between rounded-md border border-border/14 bg-background/25 px-[12px] py-[10px]">
                <div>
                  <div className="text-[12px] font-medium text-foreground/85">RSS Feed</div>
                  <div className="mt-[2px] text-[11px] text-muted-foreground/50">{settings.rss_enabled === "false" ? "隐藏订阅入口" : "公开 /rss.xml"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, rss_enabled: prev.rss_enabled === "false" ? "true" : "false" }))}
                  className="min-h-[36px] rounded-md border border-border/25 px-[10px] text-[12px] text-muted-foreground/80 hover:text-foreground"
                >
                  {settings.rss_enabled === "false" ? "开启" : "关闭"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-border/20 bg-card/5 p-[14px]">
            <div className="mb-[12px] flex items-center justify-between gap-[12px]">
              <div>
                <h2 className="flex items-center gap-[6px] text-[13px] font-semibold">
                  <Wand2 className="h-[14px] w-[14px] text-muted-foreground/60" />
                  单篇快速修复
                </h2>
                <p className="mt-[3px] text-[11px] text-muted-foreground/50">{selectedPost ? selectedPost.slug : "从队列中选择一篇文章"}</p>
              </div>
              {selectedReport ? <span className={`rounded-md border px-[7px] py-[3px] font-mono text-[11px] ${scoreTone(selectedReport.totalScore)}`}>{selectedReport.totalScore}</span> : null}
            </div>
            {selectedPost && draft ? (
              <div className="space-y-[12px]">
                <SettingsField label="SEO 标题" value={draft.title} onChange={(value) => setDraft((prev) => prev ? { ...prev, title: value } : prev)} />
                <SettingsField label="URL Slug" value={draft.slug} onChange={(value) => setDraft((prev) => prev ? { ...prev, slug: value } : prev)} mono hint="改 slug 会改变文章访问路径，请保存后检查旧链接来源。" />
                <SettingsField label="Meta 摘要" value={draft.excerpt} onChange={(value) => setDraft((prev) => prev ? { ...prev, excerpt: value } : prev)} multiline hint={`${draft.excerpt.length} 字符，建议 60-160。`} />
                <SettingsField label="标签" value={draft.tags} onChange={(value) => setDraft((prev) => prev ? { ...prev, tags: value } : prev)} placeholder="React, Cloudflare, SEO" />
                <SettingsField label="封面 / OG 图" value={draft.coverImage} onChange={(value) => setDraft((prev) => prev ? { ...prev, coverImage: value } : prev)} mono />
                {selectedReport?.checks.some((check) => check.status !== "pass") ? (
                  <div className="rounded-md border border-border/14 bg-background/25 p-[10px]">
                    <div className="mb-[6px] text-[11px] font-medium text-muted-foreground/60">当前未通过项</div>
                    <div className="flex flex-wrap gap-[5px]">
                      {selectedReport.checks.filter((check) => check.status !== "pass").map((check) => (
                        <span key={check.id} className="inline-flex items-center gap-[4px] rounded-md bg-card/35 px-[6px] py-[3px] text-[10px] text-muted-foreground/75" title={check.detail}>
                          <StatusIcon status={check.status} />
                          {check.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-[8px]">
                  <button type="button" onClick={applyAutoFixes} className="inline-flex min-h-[40px] items-center justify-center gap-[6px] rounded-md border border-border/25 bg-background/35 px-[10px] text-[12px] font-medium text-foreground transition-colors hover:bg-card/25">
                    <Wand2 className="h-[12px] w-[12px]" />
                    自动填补
                  </button>
                  <button type="button" onClick={savePost} disabled={postSaving} className="inline-flex min-h-[40px] items-center justify-center gap-[6px] rounded-md bg-foreground px-[10px] text-[12px] font-medium text-background disabled:opacity-50">
                    <Save className="h-[12px] w-[12px]" />
                    保存文章
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-border/14 bg-background/25 px-[12px] py-[24px] text-center text-[12px] text-muted-foreground/55">
                选择一篇文章后即可直接修标题、摘要、标签和分享图。
              </div>
            )}
          </section>

          <section className="rounded-md border border-border/20 bg-card/5">
            <div className="flex items-center justify-between border-b border-border/12 p-[12px]">
              <h2 className="flex items-center gap-[6px] text-[12px] font-semibold">
                <FileText className="h-[12px] w-[12px] text-muted-foreground/60" />
                Sitemap.xml
                {sitemapPreview ? <span className="text-[10px] font-normal text-muted-foreground/50">{sitemapPreview.urls.length} URLs</span> : null}
              </h2>
              <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 hover:text-foreground" title="新窗口打开">
                <ExternalLink className="h-[12px] w-[12px]" />
              </a>
            </div>
            <div className="max-h-[180px] space-y-[2px] overflow-y-auto overscroll-contain p-[10px] scrollbar-thin">
              {sitemapPreview?.urls.length ? (
                sitemapPreview.urls.slice(0, 40).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block truncate font-mono text-[11px] text-muted-foreground/70 hover:text-foreground/78">
                    {url}
                  </a>
                ))
              ) : (
                <div className="py-[12px] text-center text-[11px] text-muted-foreground/50">未抓取到 URL</div>
              )}
            </div>
          </section>

          <section className="rounded-md border border-border/20 bg-card/5">
            <div className="flex items-center justify-between border-b border-border/12 p-[12px]">
              <h2 className="flex items-center gap-[6px] text-[12px] font-semibold">
                <Image className="h-[12px] w-[12px] text-muted-foreground/60" />
                Robots.txt
              </h2>
              <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 hover:text-foreground" title="新窗口打开">
                <ExternalLink className="h-[12px] w-[12px]" />
              </a>
            </div>
            <pre className="max-h-[180px] overflow-y-auto overscroll-contain p-[10px] font-mono text-[11px] leading-[1.6] text-muted-foreground/80 scrollbar-thin whitespace-pre-wrap">
              {robotsPreview || "未拉取到 robots.txt"}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
