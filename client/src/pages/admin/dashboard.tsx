import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { fetchAdminPosts, deletePost, batchOperatePosts, fetchViewStats, type Post, type ViewStats } from "@/lib/api";
import { Plus, Edit, Trash2, Eye, FileText, Clock, Search, ExternalLink, Globe, CheckCircle2, AlertTriangle, XCircle, CheckSquare, Square, EyeOff, TrendingUp, ArrowRight, BarChart3 } from "lucide-react";
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


  return (
    <div className="mx-auto w-full max-w-[960px] py-[24px] sm:py-[36px] px-[16px] sm:px-[20px]">

      {/* ═══════════ 顶栏：标题 + 操作 ═══════════ */}
      <div className="mb-[24px] sm:mb-[32px]">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-[-0.02em]">控制台</h1>
          <div className="flex items-center gap-[6px]">
            <Link href="/admin/editor" className="inline-flex items-center gap-[5px] h-[34px] px-[14px] rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity">
              <Plus className="h-[14px] w-[14px]" />写文章
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════ 数据概览行 ═══════════ */}
      <div className="mb-[24px] grid grid-cols-4 gap-[8px] sm:gap-[10px]">
        {([
          { key: "all" as FilterType, label: "全部", value: posts.length, icon: FileText, activeColor: "border-foreground/20 bg-foreground/[0.03]", iconColor: "text-foreground/60" },
          { key: "published" as FilterType, label: "已发布", value: publishedCount, icon: Eye, activeColor: "border-emerald-500/25 bg-emerald-500/[0.04]", iconColor: "text-emerald-400/70" },
          { key: "draft" as FilterType, label: "草稿", value: draftCount, icon: Clock, activeColor: "border-amber-500/25 bg-amber-500/[0.04]", iconColor: "text-amber-400/70" },
        ] as const).map((stat) => (
          <button key={stat.key} onClick={() => { setFilter(stat.key); setSelectedTag(""); }}
            className={`rounded-xl border p-[12px] sm:p-[14px] text-left transition-all ${filter === stat.key && !selectedTag ? stat.activeColor : "border-border/15 bg-card/5 hover:bg-card/15 hover:border-border/30"}`}
          >
            <div className="flex items-center justify-between mb-[6px]">
              <span className="text-[10px] sm:text-[11px] text-muted-foreground/40 font-medium uppercase tracking-wider">{stat.label}</span>
              <stat.icon className={`h-[12px] w-[12px] ${filter === stat.key && !selectedTag ? stat.iconColor : "text-muted-foreground/15"}`} />
            </div>
            <p className="text-[22px] sm:text-[26px] font-bold leading-none tracking-tight">{stat.value}</p>
          </button>
        ))}
        <div className="rounded-xl border border-border/15 bg-card/5 p-[12px] sm:p-[14px] text-left">
          <div className="flex items-center justify-between mb-[6px]">
            <span className="text-[10px] sm:text-[11px] text-muted-foreground/40 font-medium uppercase tracking-wider">浏览量</span>
            <TrendingUp className="h-[12px] w-[12px] text-cyan-400/40" />
          </div>
          <p className="text-[22px] sm:text-[26px] font-bold leading-none tracking-tight">{viewStats?.totalViews?.toLocaleString() ?? "—"}</p>
        </div>
      </div>

      {/* ═══════════ 搜索框 ═══════════ */}
      <div className="mb-[16px]">
        <div className="relative">
          <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-muted-foreground/25" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题、Slug 或标签..."
            className="h-[38px] w-full rounded-lg border border-border/20 bg-card/8 pl-[36px] pr-[14px] text-[13px] text-foreground placeholder:text-muted-foreground/25 outline-none focus:border-foreground/15 transition-all"
          />
        </div>
      </div>

      {/* ═══════════ 两栏主布局 ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-[20px]">

        {/* ─── 文章列表 ─── */}
        <div>
          <div className="mb-[10px] flex items-center justify-between">
            <h2 className="text-[12px] font-medium text-muted-foreground/40 uppercase tracking-wider flex items-center gap-[5px]">
              {filter === "all" ? "所有文章" : filter === "published" ? "已发布" : "草稿箱"}
              {selectedTag && <><span className="text-muted-foreground/15">·</span><span className="text-cyan-400 normal-case">{selectedTag}</span></>}
            </h2>
            <span className="text-[11px] text-muted-foreground/25">{filteredPosts.length} 篇</span>
          </div>

          {/* 批量操作工具栏 */}
          {filteredPosts.length > 0 && (
            <div className={`mb-[10px] flex items-center justify-between rounded-lg border border-border/15 bg-card/10 px-[14px] py-[8px] transition-all ${selectedSlugs.size > 0 ? "border-cyan-500/30 bg-cyan-500/5" : ""}`}>
              <div className="flex items-center gap-[10px]">
                <button onClick={toggleSelectAll} className="text-muted-foreground/40 hover:text-cyan-400 transition-colors flex items-center gap-[6px]">
                  {selectedSlugs.size === filteredPosts.length ? <CheckSquare className="h-[14px] w-[14px] text-cyan-400" /> : <Square className="h-[14px] w-[14px]" />}
                  <span className="text-[12px]">{selectedSlugs.size > 0 ? `已选 ${selectedSlugs.size} 项` : "全选"}</span>
                </button>
              </div>
              
              {selectedSlugs.size > 0 && (
                <div className="flex items-center gap-[6px] animate-fade-in">
                  <button onClick={() => handleBatchOperate("publish")} disabled={batchOperating} className="flex items-center gap-[4px] px-[10px] py-[4px] rounded-md border border-border/20 text-[11px] text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-50">
                    <Eye className="h-[11px] w-[11px]" /> 发布
                  </button>
                  <button onClick={() => handleBatchOperate("unpublish")} disabled={batchOperating} className="flex items-center gap-[4px] px-[10px] py-[4px] rounded-md border border-border/20 text-[11px] text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-50">
                    <EyeOff className="h-[11px] w-[11px]" /> 撤回
                  </button>
                  <button onClick={() => handleBatchOperate("delete")} disabled={batchOperating} className="flex items-center gap-[4px] px-[10px] py-[4px] rounded-md border border-red-500/30 text-[11px] text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50">
                    <Trash2 className="h-[11px] w-[11px]" /> 删除
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="space-y-[6px]">{[1, 2, 3].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-lg border border-border/10 bg-card/5" />)}</div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/20 py-[52px] text-center">
              <FileText className="mx-auto mb-[12px] h-[24px] w-[24px] text-muted-foreground/10" />
              <p className="text-[13px] text-muted-foreground/30 mb-[12px]">
                {search || selectedTag ? "没有符合条件的文章" : "暂无文章"}
              </p>
              {!search && !selectedTag && (
                <Link href="/admin/editor" className="inline-flex items-center gap-[5px] h-[30px] px-[12px] rounded-md bg-foreground/8 text-[12px] text-foreground/70 hover:bg-foreground/15 transition-all">
                  写第一篇 <ArrowRight className="h-[11px] w-[11px]" />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-[4px]">
              {filteredPosts.map((post) => (
                <div key={post.slug} className={`group relative flex items-center gap-[12px] rounded-lg border px-[14px] py-[12px] transition-all ${selectedSlugs.has(post.slug) ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-400" : "border-border/12 bg-card/5 hover:border-border/35 hover:bg-card/20"}`}>
                  
                  {/* 复选框 */}
                  <button onClick={() => toggleSelect(post.slug)} className={`shrink-0 transition-colors ${selectedSlugs.has(post.slug) ? "text-cyan-400" : "text-muted-foreground/20 group-hover:text-muted-foreground/40"}`}>
                    {selectedSlugs.has(post.slug) ? <CheckSquare className="h-[14px] w-[14px]" /> : <Square className="h-[14px] w-[14px]" />}
                  </button>

                  {/* 状态指示点 */}
                  <div className={`h-[6px] w-[6px] rounded-full shrink-0 ${post.published ? "bg-emerald-400/60" : "bg-amber-400/50"}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[6px] mb-[3px]">
                      <Link href={`/admin/editor/${post.slug}`} className="text-[14px] font-medium text-foreground/85 truncate hover:text-cyan-400 transition-colors">{post.title}</Link>
                      {post.pinned && <Badge variant="outline" className="h-[16px] rounded-[3px] px-[4px] text-[9px] font-medium text-amber-500/80 border-amber-500/20 bg-amber-500/5">置顶</Badge>}
                    </div>
                    <div className="flex items-center gap-[8px] text-[11px] text-muted-foreground/30">
                      <span>{timeAgo(post.updatedAt || post.createdAt)}</span>
                      <span className="flex items-center gap-[2px]"><Eye className="h-[9px] w-[9px]" />{(post.viewCount ?? 0).toLocaleString()}</span>
                      {post.tags.length > 0 && <span>{post.tags.slice(0, 2).join(" · ")}</span>}
                    </div>
                  </div>

                  {/* 操作按钮 — hover 显现 */}
                  <div className="flex items-center gap-[2px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={`/posts/${post.slug}`} target="_blank" title="预览" className="flex h-[28px] w-[28px] items-center justify-center rounded-md text-muted-foreground/30 hover:text-cyan-400 hover:bg-cyan-400/8 transition-all">
                      <ExternalLink className="h-[12px] w-[12px]" />
                    </a>
                    <Link href={`/admin/editor/${post.slug}`} title="编辑" className="flex h-[28px] w-[28px] items-center justify-center rounded-md text-muted-foreground/30 hover:text-amber-400 hover:bg-amber-400/8 transition-all">
                      <Edit className="h-[12px] w-[12px]" />
                    </Link>
                    <button onClick={() => handleDelete(post.slug, post.title)} disabled={deleting === post.slug} title="删除" className="flex h-[28px] w-[28px] items-center justify-center rounded-md text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/8 transition-all disabled:opacity-30">
                      <Trash2 className={`h-[12px] w-[12px] ${deleting === post.slug ? "animate-pulse" : ""}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── 右侧边栏：标签 + 热门 + SEO ─── */}
        <div className="space-y-[14px] lg:sticky lg:top-[24px] lg:self-start">

          {/* SEO 健康状态 */}
          {posts.length > 0 && (() => {
            const published = posts.filter(p => p.published);
            const withExcerpt = published.filter(p => p.excerpt && p.excerpt.trim().length > 0);
            const withTags = published.filter(p => p.tags.length > 0);
            const goodSlug = published.filter(p => /^[a-z0-9-]+$/.test(p.slug) && !p.slug.includes("--") && !p.slug.startsWith("-") && !p.slug.endsWith("-"));
            const withTitle50 = published.filter(p => p.title.length <= 60 && p.title.length >= 5);

            const checks = [
              { label: "Meta 摘要", ok: withExcerpt.length, total: published.length, desc: "已填写 excerpt" },
              { label: "标签覆盖", ok: withTags.length, total: published.length, desc: "至少 1 个标签" },
              { label: "URL 规范", ok: goodSlug.length, total: published.length, desc: "slug 为小写+连字符" },
              { label: "标题长度", ok: withTitle50.length, total: published.length, desc: "5-60 字符" },
            ];

            const totalOk = checks.reduce((s, c) => s + c.ok, 0);
            const totalAll = checks.reduce((s, c) => s + c.total, 0);
            const score = totalAll > 0 ? Math.round((totalOk / totalAll) * 100) : 0;

            const scoreColor = score >= 90 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-red-400";
            const scoreBg = score >= 90 ? "bg-emerald-500/8" : score >= 70 ? "bg-amber-500/8" : "bg-red-500/8";
            const scoreBorder = score >= 90 ? "border-emerald-500/20" : score >= 70 ? "border-amber-500/20" : "border-red-500/20";

            return (
              <div className={`rounded-xl border ${scoreBorder} ${scoreBg} p-[14px]`}>
                <div className="flex items-center justify-between mb-[10px]">
                  <h3 className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider flex items-center gap-[4px]">
                    <Globe className="h-[10px] w-[10px] text-cyan-400/50" />SEO 健康
                  </h3>
                  <span className={`text-[18px] font-bold ${scoreColor}`}>{score}%</span>
                </div>
                <div className="space-y-[6px]">
                  {checks.map(c => {
                    const pct = c.total > 0 ? Math.round((c.ok / c.total) * 100) : 0;
                    const Icon = pct === 100 ? CheckCircle2 : pct >= 70 ? AlertTriangle : XCircle;
                    const color = pct === 100 ? "text-emerald-400/70" : pct >= 70 ? "text-amber-400/70" : "text-red-400/60";
                    return (
                      <div key={c.label} className="flex items-center gap-[6px]">
                        <Icon className={`h-[11px] w-[11px] shrink-0 ${color}`} />
                        <span className="flex-1 text-[11px] text-foreground/50">{c.label}</span>
                        <span className="text-[10px] text-muted-foreground/30">{c.ok}/{c.total}</span>
                      </div>
                    );
                  })}
                </div>
                {/* sitemap + robots 固定指标 */}
                <div className="mt-[8px] pt-[8px] border-t border-border/10 space-y-[4px]">
                  {[
                    { label: "Sitemap", ok: true },
                    { label: "Robots noindex (404)", ok: true },
                    { label: "JSON-LD 结构化", ok: true },
                    { label: "OG 社交标签", ok: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-[6px]">
                      <CheckCircle2 className="h-[11px] w-[11px] shrink-0 text-emerald-400/50" />
                      <span className="text-[11px] text-foreground/40">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 标签 */}
          {allTags.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-[8px]">
                <h3 className="text-[10px] font-medium text-muted-foreground/30 uppercase tracking-wider">标签</h3>
                {allTags.length > 8 && (
                  <button onClick={() => setTagExpanded(!tagExpanded)} className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors">
                    {tagExpanded ? "收起" : `+${allTags.length - 8}`}
                  </button>
                )}
              </div>
              <div className={`flex flex-wrap gap-[4px] ${!tagExpanded ? "max-h-[64px] overflow-hidden" : ""}`}>
                {allTags.map((tag) => {
                  const count = posts.filter((p) => p.tags.includes(tag)).length;
                  return (
                    <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
                      className={`inline-flex items-center gap-[4px] h-[24px] px-[8px] rounded-md text-[11px] transition-all ${
                        selectedTag === tag
                          ? "bg-cyan-500/12 text-cyan-400 font-medium"
                          : "text-muted-foreground/40 hover:text-foreground/70 hover:bg-card/30"
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
              <h3 className="mb-[8px] text-[10px] font-medium text-muted-foreground/30 uppercase tracking-wider flex items-center gap-[4px]">
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
