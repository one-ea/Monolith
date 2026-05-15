import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { fetchAdminPosts, deletePost, batchOperatePosts, fetchViewStats, type Post, type ViewStats } from "@/lib/api";
import { Plus, Edit, Trash2, Eye, FileText, Clock, Search, ExternalLink, Globe, CheckSquare, Square, EyeOff, TrendingUp, ArrowRight, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

type FilterType = "all" | "published" | "draft";

export function AdminDashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [tagExpanded, setTagExpanded] = useState(false);
  const [viewStats, setViewStats] = useState<ViewStats | null>(null);

  useEffect(() => {
    document.title = "管理后台 | Monolith";
    fetchAdminPosts().then(setPosts).finally(() => setLoading(false));
    fetchViewStats().then(setViewStats).catch(() => {});
  }, []);

  const handleDelete = async (slug: string, title: string) => {
    if (!confirm(`确定删除「${title}」？此操作不可撤销。`)) return;
    setDeleting(slug);
    try {
      await deletePost(slug);
      setPosts((prev) => prev.filter((p) => p.slug !== slug));
      setSelectedSlugs((prev) => { const next = new Set(prev); next.delete(slug); return next; });
    } finally {
      setDeleting(null);
    }
  };

  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [batchOperating, setBatchOperating] = useState(false);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (filter === "published") result = result.filter((p) => p.published);
    if (filter === "draft") result = result.filter((p) => !p.published);
    if (selectedTag) result = result.filter((p) => p.tags.includes(selectedTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [posts, filter, selectedTag, search]);

  useEffect(() => {
    setSelectedSlugs(prev => {
      if (prev.size === 0) return prev;
      const valid = new Set([...prev].filter(s => filteredPosts.some(p => p.slug === s)));
      return valid.size === prev.size ? prev : valid;
    });
  }, [filteredPosts]);

  const toggleSelectAll = () => {
    if (selectedSlugs.size === filteredPosts.length && filteredPosts.length > 0) setSelectedSlugs(new Set());
    else setSelectedSlugs(new Set(filteredPosts.map((p) => p.slug)));
  };

  const toggleSelect = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleBatchOperate = async (action: "publish" | "unpublish" | "delete") => {
    if (selectedSlugs.size === 0) return;
    const actionName = action === "publish" ? "发布" : action === "unpublish" ? "撤回发布" : "删除";
    if (!confirm(`确定要批量${actionName}选中的 ${selectedSlugs.size} 篇文章吗？${action === "delete" ? "此操作不可恢复！" : ""}`)) return;
    
    setBatchOperating(true);
    try {
      const slugs = Array.from(selectedSlugs);
      await batchOperatePosts(slugs, action);
      if (action === "delete") {
        setPosts((prev) => prev.filter((p) => !slugs.includes(p.slug)));
      } else {
        setPosts((prev) => prev.map((p) => slugs.includes(p.slug) ? { ...p, published: action === "publish" } : p));
      }
      setSelectedSlugs(new Set());
    } catch (err: any) {
      alert(err.message || "批量操作失败");
    } finally {
      setBatchOperating(false);
    }
  };



  const publishedCount = posts.filter((p) => p.published).length;
  const draftCount = posts.filter((p) => !p.published).length;
  const allTags = useMemo(() => {
    const tagSet = new Set(posts.flatMap((p) => p.tags));
    return Array.from(tagSet).sort();
  }, [posts]);

  const seoHealth = useMemo(() => {
    if (posts.length === 0) return null;

    const published = posts.filter((p) => p.published);
    const withExcerpt = published.filter((p) => p.excerpt && p.excerpt.trim().length > 0);
    const withTags = published.filter((p) => p.tags.length > 0);
    const goodSlug = published.filter((p) => /^[a-z0-9-]+$/.test(p.slug) && !p.slug.includes("--") && !p.slug.startsWith("-") && !p.slug.endsWith("-"));
    const withTitle50 = published.filter((p) => p.title.length <= 60 && p.title.length >= 5);

    const checks = [
      { label: "Meta", ok: withExcerpt.length, total: published.length, desc: "摘要" },
      { label: "标签", ok: withTags.length, total: published.length, desc: "覆盖" },
      { label: "URL", ok: goodSlug.length, total: published.length, desc: "规范" },
      { label: "标题", ok: withTitle50.length, total: published.length, desc: "长度" },
    ];

    const totalOk = checks.reduce((sum, check) => sum + check.ok, 0);
    const totalAll = checks.reduce((sum, check) => sum + check.total, 0);
    const score = totalAll > 0 ? Math.round((totalOk / totalAll) * 100) : 0;
    const tone = score >= 90
      ? { label: "优秀", text: "text-foreground/85", dot: "bg-cyan-300/80", bar: "bg-cyan-300/85" }
      : score >= 70
        ? { label: "需关注", text: "text-foreground/75", dot: "bg-amber-400/70", bar: "bg-amber-400/75" }
        : { label: "待修复", text: "text-foreground/75", dot: "bg-red-400/70", bar: "bg-red-400/75" };

    return { score, tone };
  }, [posts]);


  return (
    <div className="mx-auto w-full max-w-[1100px] px-[16px] py-[18px] sm:px-[20px] sm:py-[28px]">

      {/* ═══════════ 顶栏：标题 + 操作 ═══════════ */}
      <div className="mb-[18px] rounded-md border border-border/18 bg-card/[0.16] p-[16px] shadow-[0_18px_60px_oklch(0_0_0_/_10%)] sm:p-[18px]">
        <div className="flex flex-col gap-[16px] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[12px] text-muted-foreground/42">今日工作台</p>
            <h1 className="mt-[4px] font-heading text-[24px] font-semibold tracking-[-0.02em] text-foreground/92 sm:text-[30px]">内容运营控制台</h1>
            <p className="mt-[8px] max-w-[560px] text-[13px] leading-[1.7] text-muted-foreground/60">
              集中处理文章状态、搜索筛选、批量发布、SEO 健康与访问趋势。
            </p>
          </div>
          <div className="flex flex-col gap-[10px] sm:flex-row sm:items-center lg:shrink-0">
            {seoHealth && (
              <Link
                href="/admin/seo"
                className="group flex min-h-[44px] min-w-0 items-center gap-[12px] rounded-md border border-border/18 bg-background/32 px-[12px] transition-colors hover:border-border/30 hover:bg-background/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-w-[260px]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-[10px]">
                  <div className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-border/15 bg-background/35">
                    <Globe className="h-[14px] w-[14px] text-foreground/70" />
                    <span className={`absolute right-[4px] top-[4px] h-[4px] w-[4px] rounded-full ${seoHealth.tone.dot}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-[10px]">
                      <span className="truncate text-[12px] font-semibold text-foreground/80">SEO 健康</span>
                      <span className={`text-[13px] font-bold tabular-nums ${seoHealth.tone.text}`}>{seoHealth.score}%</span>
                    </div>
                    <div className="mt-[6px] h-[4px] overflow-hidden rounded-full bg-background/60">
                      <div
                        className={`h-full rounded-full ${seoHealth.tone.bar} transition-[width] duration-300`}
                        style={{ width: `${seoHealth.score}%` }}
                      />
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-[12px] w-[12px] shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-[2px] group-hover:text-foreground/70" />
              </Link>
            )}
            <Link href="/admin/editor" className="inline-flex min-h-[44px] items-center justify-center gap-[6px] rounded-md bg-foreground px-[16px] text-[13px] font-medium text-background transition-all hover:-translate-y-[2px] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-[36px]">
              <Plus className="h-[14px] w-[14px]" />写文章
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════ 数据概览行 ═══════════ */}
      <div className="mb-[18px] grid grid-cols-2 gap-[8px] sm:grid-cols-4 sm:gap-[10px]">
        {([
          { key: "all" as FilterType, label: "全部", value: posts.length, icon: FileText },
          { key: "published" as FilterType, label: "已发布", value: publishedCount, icon: Eye },
          { key: "draft" as FilterType, label: "草稿", value: draftCount, icon: Clock },
        ] as const).map((stat) => (
          <button key={stat.key} onClick={() => { setFilter(stat.key); setSelectedTag(""); }}
            className={`min-h-[88px] rounded-md border p-[12px] text-left transition-all hover:-translate-y-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-[14px] ${filter === stat.key && !selectedTag ? "border-foreground/22 bg-foreground/[0.04]" : "border-border/15 bg-background/20 hover:border-border/30 hover:bg-card/12"}`}
          >
            <div className="flex items-center justify-between mb-[6px]">
              <span className="text-[10px] font-medium tracking-normal text-muted-foreground/45 sm:text-[11px]">{stat.label}</span>
              <stat.icon className={`h-[12px] w-[12px] ${filter === stat.key && !selectedTag ? "text-foreground/65" : "text-muted-foreground/15"}`} />
            </div>
            <p className="font-mono text-[22px] font-semibold leading-none tracking-[-0.02em] sm:text-[26px]">{stat.value}</p>
          </button>
        ))}
        <div className="min-h-[88px] rounded-md border border-border/15 bg-background/20 p-[12px] text-left sm:p-[14px]">
          <div className="flex items-center justify-between mb-[6px]">
            <span className="text-[10px] font-medium tracking-normal text-muted-foreground/45 sm:text-[11px]">浏览量</span>
            <TrendingUp className="h-[12px] w-[12px] text-muted-foreground/25" />
          </div>
          <p className="font-mono text-[22px] font-semibold leading-none tracking-[-0.02em] sm:text-[26px]">{viewStats?.totalViews?.toLocaleString() ?? "—"}</p>
        </div>
      </div>

      {/* ═══════════ 搜索框 ═══════════ */}
      <div className="mb-[16px]">
        <div className="relative">
          <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-muted-foreground/25" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题、Slug 或标签..."
            className="h-[36px] w-full rounded-md border border-border/20 bg-background/35 pl-[36px] pr-[14px] text-[13px] text-foreground outline-none transition-all placeholder:text-muted-foreground/35 focus:border-foreground/25 focus:bg-background/55"
          />
        </div>
      </div>

      {/* ═══════════ 两栏主布局 ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-[20px]">

        {/* ─── 文章列表 ─── */}
        <div className="flex flex-col min-h-0 lg:max-h-[calc(100vh-260px)]">
          <div className="mb-[10px] flex items-center justify-between shrink-0">
            <h2 className="flex items-center gap-[4px] text-[12px] font-medium tracking-normal text-muted-foreground/45">
              {filter === "all" ? "所有文章" : filter === "published" ? "已发布" : "草稿箱"}
              {selectedTag && <><span className="text-muted-foreground/15">·</span><span className="normal-case text-foreground/70">{selectedTag}</span></>}
            </h2>
            <span className="text-[11px] text-muted-foreground/25">{filteredPosts.length} 篇</span>
          </div>

          {/* 批量操作工具栏 */}
          {filteredPosts.length > 0 && (
            <div className={`mb-[10px] flex min-h-[40px] flex-wrap items-center justify-between gap-[8px] rounded-md border border-border/15 bg-background/25 px-[14px] py-[4px] transition-all shrink-0 ${selectedSlugs.size > 0 ? "border-foreground/20 bg-foreground/[0.03]" : ""}`}>
              <div className="flex items-center gap-[10px]">
                <button onClick={toggleSelectAll} className="flex min-h-[32px] items-center gap-[6px] rounded-md text-muted-foreground/50 transition-colors hover:text-foreground/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {selectedSlugs.size === filteredPosts.length ? <CheckSquare className="h-[14px] w-[14px] text-foreground/75" /> : <Square className="h-[14px] w-[14px]" />}
                  <span className="text-[12px]">{selectedSlugs.size > 0 ? `已选 ${selectedSlugs.size} 项` : "全选"}</span>
                </button>
              </div>
              
              {selectedSlugs.size > 0 && (
                <div className="flex items-center gap-[6px] animate-fade-in">
                  <button onClick={() => handleBatchOperate("publish")} disabled={batchOperating} className="flex h-[28px] items-center gap-[4px] rounded-md border border-border/20 px-[10px] text-[11px] text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50">
                    <Eye className="h-[11px] w-[11px]" /> 发布
                  </button>
                  <button onClick={() => handleBatchOperate("unpublish")} disabled={batchOperating} className="flex h-[28px] items-center gap-[4px] rounded-md border border-border/20 px-[10px] text-[11px] text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50">
                    <EyeOff className="h-[11px] w-[11px]" /> 撤回
                  </button>
                  <button onClick={() => handleBatchOperate("delete")} disabled={batchOperating} className="flex h-[28px] items-center gap-[4px] rounded-md border border-red-500/30 px-[10px] text-[11px] text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50">
                    <Trash2 className="h-[11px] w-[11px]" /> 删除
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="space-y-[6px] shrink-0">{[1, 2, 3].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-lg border border-border/10 bg-card/5" />)}</div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/20 py-[52px] text-center shrink-0">
              <FileText className="mx-auto mb-[12px] h-[24px] w-[24px] text-muted-foreground/10" />
              <p className="text-[13px] text-muted-foreground/30 mb-[12px]">
                {search || selectedTag ? "没有符合条件的文章" : "暂无文章"}
              </p>
              {!search && !selectedTag && (
                <Link href="/admin/editor" className="inline-flex items-center gap-[4px] h-[30px] px-[12px] rounded-md bg-foreground/8 text-[12px] text-foreground/70 hover:bg-foreground/15 transition-all">
                  写第一篇 <ArrowRight className="h-[11px] w-[11px]" />
                </Link>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-[4px] -mr-[4px] scrollbar-thin">
              <div className="overflow-hidden rounded-md border border-border/12 bg-background/18">
                <div className="hidden h-[32px] items-center border-b border-border/8 bg-foreground/[0.02] px-[14px] text-[11px] text-muted-foreground/35 sm:grid sm:grid-cols-[44px_1fr_96px_112px]">
                  <span />
                  <span>文章</span>
                  <span className="text-right">浏览</span>
                  <span className="text-right">操作</span>
                </div>
              {filteredPosts.map((post) => (
                <div key={post.slug} className={`group relative flex min-h-[64px] items-center gap-[12px] border-b border-border/8 px-[12px] py-[10px] transition-all last:border-b-0 sm:px-[14px] ${selectedSlugs.has(post.slug) ? "bg-foreground/[0.035]" : "hover:bg-card/16"}`}>
                  
                  {/* 复选框 */}
                  <button onClick={() => toggleSelect(post.slug)} className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selectedSlugs.has(post.slug) ? "text-foreground/75" : "text-muted-foreground/25 group-hover:text-muted-foreground/50"}`} aria-label={`选择 ${post.title}`}>
                    {selectedSlugs.has(post.slug) ? <CheckSquare className="h-[14px] w-[14px]" /> : <Square className="h-[14px] w-[14px]" />}
                  </button>

                  {/* 状态指示点 */}
                  <div className={`h-[6px] w-[6px] rounded-full shrink-0 ${post.published ? "bg-cyan-300/65" : "bg-muted-foreground/30"}`} />

                  <div className="flex-1 min-w-0">
                    <div className="mb-[4px] flex items-center gap-[6px]">
                      <Link href={`/admin/editor/${post.slug}`} className="truncate text-[14px] font-medium text-foreground/85 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{post.title}</Link>
                      {post.pinned && <Badge variant="outline" className="h-[16px] rounded-[3px] px-[4px] text-[9px] font-medium text-amber-500/80 border-amber-500/20 bg-amber-500/5">置顶</Badge>}
                    </div>
                    <div className="flex items-center gap-[8px] text-[11px] text-muted-foreground/30">
                      <span>{timeAgo(post.updatedAt || post.createdAt)}</span>
                      <span className="flex items-center gap-[2px] font-mono"><Eye className="h-[9px] w-[9px]" />{(post.viewCount ?? 0).toLocaleString()}</span>
                      {post.tags.length > 0 && <span>{post.tags.slice(0, 2).join(" · ")}</span>}
                    </div>
                  </div>

                  {/* 操作按钮 — hover 显现 */}
                  <div className="flex shrink-0 items-center gap-[2px] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <a href={`/posts/${post.slug}`} target="_blank" title="预览" aria-label={`预览 ${post.title}`} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground/35 transition-all hover:bg-foreground/[0.06] hover:text-foreground/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <ExternalLink className="h-[12px] w-[12px]" />
                    </a>
                    <Link href={`/admin/editor/${post.slug}`} title="编辑" aria-label={`编辑 ${post.title}`} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground/35 transition-all hover:bg-amber-400/8 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <Edit className="h-[12px] w-[12px]" />
                    </Link>
                    <button onClick={() => handleDelete(post.slug, post.title)} disabled={deleting === post.slug} title="删除" aria-label={`删除 ${post.title}`} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground/35 transition-all hover:bg-red-400/8 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-30">
                      <Trash2 className={`h-[12px] w-[12px] ${deleting === post.slug ? "animate-pulse" : ""}`} />
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── 右侧边栏：标签 + 热门 ─── */}
        <div className="space-y-[14px] lg:sticky lg:top-[24px] lg:self-start">

          {/* 标签 */}
          {allTags.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-[8px]">
                <h3 className="text-[10px] font-medium tracking-normal text-muted-foreground/35">标签</h3>
                {allTags.length > 8 && (
                  <button onClick={() => setTagExpanded(!tagExpanded)} className="text-[10px] text-muted-foreground/55 transition-colors hover:text-foreground/75">
                    {tagExpanded ? "收起" : `+${allTags.length - 8}`}
                  </button>
                )}
              </div>
              <div className={`flex flex-wrap gap-[4px] ${!tagExpanded ? "max-h-[64px] overflow-hidden" : ""}`}>
                {allTags.map((tag) => {
                  const count = posts.filter((p) => p.tags.includes(tag)).length;
                  return (
                    <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
                    className={`inline-flex h-[24px] items-center gap-[4px] rounded-md border px-[8px] text-[11px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        selectedTag === tag
                          ? "border-foreground/18 bg-foreground/[0.08] text-foreground/85 font-medium"
                          : "border-border/10 text-muted-foreground/40 hover:text-foreground/70 hover:bg-card/30"
                      }`}
                    >
                      {tag}<span className="text-[9px] opacity-50">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 热门文章 */}
          {viewStats && viewStats.topPosts.length > 0 && (
            <div>
              <h3 className="mb-[8px] flex items-center gap-[4px] text-[10px] font-medium tracking-normal text-muted-foreground/35">
                <BarChart3 className="h-[10px] w-[10px] text-amber-500/40" />热门
              </h3>
              <div className="space-y-[2px]">
                {viewStats.topPosts.slice(0, 5).map((item, i) => (
                  <Link key={item.slug} href={`/posts/${item.slug}`}
                    className="flex items-center gap-[8px] rounded-md px-[6px] py-[6px] hover:bg-card/20 transition-colors group"
                  >
                    <span className={`text-[10px] font-bold w-[14px] text-center shrink-0 ${
                      i === 0 ? "text-amber-500" : i < 3 ? "text-muted-foreground/40" : "text-muted-foreground/20"
                    }`}>{i + 1}</span>
                    <span className="flex-1 text-[12px] text-foreground/50 group-hover:text-foreground/80 truncate transition-colors">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground/20 shrink-0">{item.viewCount.toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
