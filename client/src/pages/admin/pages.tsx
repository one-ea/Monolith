import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/api";
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical, FileText, Navigation, Save } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

type PageItem = {
  id: number; slug: string; title: string; content: string;
  sortOrder: number; published: boolean; showInNav: boolean;
  createdAt: string; updatedAt: string;
};

export function AdminPages() {
  const [pagesList, setPagesList] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PageItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" as "" | "success" | "error" });
  const [loadError, setLoadError] = useState("");

  const authHeaders = { Authorization: `Bearer ${getToken()}` };
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };

  useEffect(() => {
    document.title = "页面管理 | Monolith";
    loadPages();
  }, []);

  const showMsg = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  }, []);

  const loadPages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pages", { headers: authHeaders });
      if (!res.ok) throw new Error("加载页面列表失败");
      const data = await res.json();
      setPagesList(Array.isArray(data) ? data : []);
      setLoadError("");
    } catch {
      setPagesList([]);
      setLoadError("页面列表加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setIsNew(true);
    setEditing({
      id: 0, slug: "", title: "", content: "",
      sortOrder: pagesList.length, published: true, showInNav: false,
      createdAt: "", updatedAt: "",
    });
  };

  const startEdit = (page: PageItem) => {
    setIsNew(false);
    setEditing({ ...page });
  };

  const savePage = async () => {
    if (!editing) return;
    if (!editing.slug.trim() || !editing.title.trim()) {
      showMsg("Slug 和标题不能为空", "error"); return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST", headers: jsonHeaders,
        body: JSON.stringify({
          slug: editing.slug, title: editing.title, content: editing.content,
          sortOrder: editing.sortOrder, published: editing.published, showInNav: editing.showInNav,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg(data.action === "created" ? "页面已创建" : "页面已更新", "success");
        setEditing(null);
        loadPages();
      } else showMsg("保存失败", "error");
    } catch { showMsg("保存失败", "error"); }
    setSaving(false);
  };

  const deletePage = async (slug: string, title: string) => {
    if (!confirm(`确定删除「${title}」？`)) return;
    try {
      const res = await fetch("/api/admin/pages/delete", {
        method: "POST", headers: jsonHeaders, body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.success) {
        setPagesList((prev) => prev.filter((p) => p.slug !== slug));
        if (editing?.slug === slug) setEditing(null);
        showMsg("已删除", "success");
      }
    } catch { showMsg("删除失败", "error"); }
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[\s]+/g, "-").replace(/[^\w-]/g, "").slice(0, 50) || "new-page";
  };

  const inputClass = "h-[34px] w-full rounded-md border border-border/25 bg-background/20 px-[12px] text-[13px] text-foreground placeholder:text-muted-foreground/20 outline-none focus:border-foreground/15 transition-colors";

  return (
    <div className="mx-auto w-full max-w-[800px] py-[32px]">
      {/* 顶栏 */}
      <div className="mb-[24px] flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">页面管理</h1>
          <p className="text-[12px] text-muted-foreground/35 mt-[2px]">管理"关于"、"友链"等自定义页面</p>
        </div>
        <div className="flex items-center gap-[8px]">
          {message.text && (
            <span className={`text-[12px] px-[10px] py-[3px] rounded-md animate-fade-in ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {message.type === "success" ? "✓" : "✕"} {message.text}
            </span>
          )}
          <button onClick={startNew}
            className="inline-flex items-center gap-[5px] h-[34px] px-[14px] rounded-md bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-[13px] w-[13px]" />新建页面
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-[16px] rounded-lg border border-red-500/20 bg-red-500/10 px-[14px] py-[10px] text-[12px] text-red-400">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[280px_1fr]">
        {/* 左侧：页面列表 */}
        <div className="rounded-lg border border-border/25 overflow-hidden h-fit">
          <div className="px-[14px] py-[10px] border-b border-border/15 bg-card/10">
            <h3 className="text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wider">
              <FileText className="inline h-[11px] w-[11px] mr-[4px]" />所有页面 ({pagesList.length})
            </h3>
          </div>
          {loading ? (
            <div className="p-[16px] space-y-[6px]">{[1, 2].map((i) => <div key={i} className="h-[48px] animate-pulse rounded bg-card/15" />)}</div>
          ) : pagesList.length === 0 ? (
            <div className="py-[32px] text-center">
              <FileText className="mx-auto mb-[8px] h-[18px] w-[18px] text-muted-foreground/15" />
              <p className="text-[11px] text-muted-foreground/25">还没有自定义页面</p>
            </div>
          ) : (
            pagesList.map((page) => (
              <div key={page.slug}
                className={`flex items-center gap-[10px] px-[14px] py-[10px] border-b border-border/8 cursor-pointer transition-colors ${editing?.slug === page.slug ? "bg-card/20" : "hover:bg-card/10"}`}
                onClick={() => startEdit(page)}
              >
                <GripVertical className="h-[12px] w-[12px] text-muted-foreground/15 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[6px]">
                    <span className="text-[13px] font-medium text-foreground truncate">{page.title}</span>
                    {!page.published && <Badge variant="outline" className="h-[14px] px-[4px] text-[8px] text-amber-400/60 border-amber-400/20">草稿</Badge>}
                    {page.showInNav && <Badge variant="outline" className="h-[14px] px-[4px] text-[8px] text-foreground/60 border-foreground/18">导航</Badge>}
                  </div>
                  <span className="text-[10px] text-muted-foreground/25 font-mono">/{page.slug}</span>
                </div>
                <div className="flex items-center gap-[1px] shrink-0">
                  <a href={`/page/${page.slug}`} target="_blank" onClick={(e) => e.stopPropagation()}
                    className="p-[4px] rounded text-muted-foreground/20 hover:text-foreground transition-colors">
                    <Eye className="h-[11px] w-[11px]" />
                  </a>
                  <button onClick={(e) => { e.stopPropagation(); deletePage(page.slug, page.title); }}
                    className="p-[4px] rounded text-muted-foreground/20 hover:text-red-400 transition-colors">
                    <Trash2 className="h-[11px] w-[11px]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 右侧：编辑面板 */}
        {editing ? (
          <div className="rounded-lg border border-border/25 bg-card/10 overflow-hidden animate-fade-in">
            <div className="px-[16px] py-[12px] border-b border-border/15 flex items-center justify-between">
              <h3 className="text-[13px] font-medium">{isNew ? "新建页面" : `编辑：${editing.title}`}</h3>
              <button onClick={savePage} disabled={saving}
                className="inline-flex items-center gap-[4px] h-[28px] px-[10px] rounded-md bg-foreground text-background text-[11px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Save className="h-[10px] w-[10px]" />{saving ? "保存中..." : "保存"}
              </button>
            </div>
            <div className="p-[16px] space-y-[12px]">
              {/* 标题 */}
              <div>
                <label className="mb-[2px] block text-[10px] text-muted-foreground/30 uppercase tracking-wider">页面标题</label>
                <input
                  value={editing.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setEditing((p) => p ? { ...p, title, slug: isNew && !p.slug ? generateSlug(title) : p.slug } : p);
                  }}
                  placeholder="关于" className={inputClass}
                />
              </div>
              {/* Slug */}
              <div>
                <label className="mb-[2px] block text-[10px] text-muted-foreground/30 uppercase tracking-wider">URL Slug</label>
                <div className="flex items-center gap-[8px]">
                  <span className="text-[12px] text-muted-foreground/25 shrink-0">/page/</span>
                  <input
                    value={editing.slug}
                    onChange={(e) => setEditing((p) => p ? { ...p, slug: e.target.value } : p)}
                    placeholder="about" className={inputClass}
                  />
                </div>
              </div>
              {/* 内容（Markdown） */}
              <div>
                <label className="mb-[2px] block text-[10px] text-muted-foreground/30 uppercase tracking-wider">页面内容（Markdown）</label>
                <textarea
                  value={editing.content}
                  onChange={(e) => setEditing((p) => p ? { ...p, content: e.target.value } : p)}
                  placeholder="使用 Markdown 编写页面内容..."
                  rows={14}
                  className="w-full rounded-md border border-border/25 bg-background/20 px-[12px] py-[10px] text-[13px] text-foreground font-mono leading-[1.7] placeholder:text-muted-foreground/20 outline-none focus:border-foreground/15 transition-colors resize-y"
                />
              </div>
              {/* 选项 */}
              <div className="grid grid-cols-3 gap-[10px]">
                <div>
                  <label className="mb-[2px] block text-[10px] text-muted-foreground/30 uppercase tracking-wider">排序</label>
                  <input
                    type="number" value={editing.sortOrder}
                    onChange={(e) => setEditing((p) => p ? { ...p, sortOrder: parseInt(e.target.value) || 0 } : p)}
                    className={inputClass}
                  />
                </div>
                <button
                  onClick={() => setEditing((p) => p ? { ...p, published: !p.published } : p)}
                  className={`rounded-md border px-[10px] py-[6px] text-left transition-all ${editing.published ? "border-emerald-400/20 bg-emerald-500/5" : "border-border/25 bg-background/10"}`}
                >
                  <div className="flex items-center gap-[5px]">
                    {editing.published ? <Eye className="h-[11px] w-[11px] text-emerald-400/70" /> : <EyeOff className="h-[11px] w-[11px] text-muted-foreground/30" />}
                    <span className="text-[11px] text-muted-foreground/60">{editing.published ? "已发布" : "草稿"}</span>
                  </div>
                </button>
                <button
                  onClick={() => setEditing((p) => p ? { ...p, showInNav: !p.showInNav } : p)}
                  className={`rounded-md border px-[10px] py-[6px] text-left transition-all ${editing.showInNav ? "border-foreground/20 bg-foreground/[0.04]" : "border-border/25 bg-background/10"}`}
                >
                  <div className="flex items-center gap-[5px]">
                    <Navigation className={`h-[11px] w-[11px] ${editing.showInNav ? "text-foreground/70" : "text-muted-foreground/30"}`} />
                    <span className="text-[11px] text-muted-foreground/60">{editing.showInNav ? "显示导航" : "隐藏导航"}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/20 flex flex-col items-center justify-center py-[60px]">
            <Edit className="h-[20px] w-[20px] text-muted-foreground/15 mb-[10px]" />
            <p className="text-[12px] text-muted-foreground/25">选择一个页面编辑，或创建新页面</p>
          </div>
        )}
      </div>
    </div>
  );
}
