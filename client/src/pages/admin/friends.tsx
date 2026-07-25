import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Link2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  approveFriend,
  createAdminFriend,
  deleteFriend,
  fetchAdminFriends,
  importSocialFriendLinks,
  rejectFriend,
  updateAdminFriend,
  type FriendLink,
  type FriendLinkStatus,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";

type FilterType = "all" | FriendLinkStatus;
type FormState = {
  id: number | null;
  name: string;
  url: string;
  description: string;
  avatarUrl: string;
  ownerName: string;
  ownerEmail: string;
  status: FriendLinkStatus;
  sortOrder: number;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  url: "",
  description: "",
  avatarUrl: "",
  ownerName: "",
  ownerEmail: "",
  status: "approved",
  sortOrder: 0,
};

const STATUS_META: Record<FriendLinkStatus, { label: string; className: string }> = {
  pending: { label: "待审核", className: "border-amber-400/20 text-amber-500" },
  approved: { label: "已通过", className: "border-emerald-400/20 text-emerald-500" },
  rejected: { label: "已拒绝", className: "border-red-400/20 text-red-500" },
};

const inputClass = "h-[36px] w-full rounded-md border border-border/25 bg-background/30 px-[10px] text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/30 focus:border-foreground/20";

function formatDate(value?: string | null) {
  if (!value) return "未记录";
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toForm(link: FriendLink): FormState {
  return {
    id: link.id,
    name: link.name,
    url: link.url,
    description: link.description || "",
    avatarUrl: link.avatarUrl || "",
    ownerName: link.ownerName || "",
    ownerEmail: link.ownerEmail || "",
    status: link.status || "pending",
    sortOrder: link.sortOrder || 0,
  };
}

export function AdminFriends() {
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadLinks = async () => {
    setLoading(true);
    try {
      setLinks(await fetchAdminFriends());
      setMessage(null);
    } catch {
      setLinks([]);
      setMessage({ type: "error", text: "友链列表加载失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "友链管理 | Monolith";
    loadLinks();
  }, []);

  const counts = useMemo(() => ({
    all: links.length,
    pending: links.filter((link) => link.status === "pending").length,
    approved: links.filter((link) => link.status === "approved").length,
    rejected: links.filter((link) => link.status === "rejected").length,
  }), [links]);

  const filteredLinks = useMemo(() => {
    const list = filter === "all" ? links : links.filter((link) => link.status === filter);
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id);
  }, [filter, links]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      setMessage({ type: "error", text: "名称和 URL 不能为空" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        url: form.url,
        description: form.description,
        avatarUrl: form.avatarUrl,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        status: form.status,
        sortOrder: form.sortOrder,
      };
      const saved = form.id
        ? await updateAdminFriend(form.id, payload)
        : await createAdminFriend(payload);
      setLinks((prev) => {
        const exists = prev.some((link) => link.id === saved.id);
        return exists ? prev.map((link) => (link.id === saved.id ? saved : link)) : [saved, ...prev];
      });
      setForm(toForm(saved));
      setMessage({ type: "success", text: form.id ? "友链已更新" : "友链已创建" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: number, action: "approve" | "reject" | "delete") => {
    if (action === "delete" && !confirm("确定删除这条友链？此操作不可撤销。")) return;
    setProcessing(id);
    try {
      if (action === "approve") await approveFriend(id);
      if (action === "reject") await rejectFriend(id);
      if (action === "delete") await deleteFriend(id);
      if (action === "delete") {
        setLinks((prev) => prev.filter((link) => link.id !== id));
        if (form.id === id) resetForm();
      } else {
        setLinks((prev) => prev.map((link) => (
          link.id === id
            ? { ...link, status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date().toISOString() }
            : link
        )));
      }
      setMessage({ type: "success", text: action === "approve" ? "已通过" : action === "reject" ? "已拒绝" : "已删除" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "操作失败" });
    } finally {
      setProcessing(null);
    }
  };

  const importLegacy = async () => {
    setSaving(true);
    try {
      const result = await importSocialFriendLinks();
      await loadLinks();
      setMessage({ type: "success", text: `已导入 ${result.imported} 条旧社交链接` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "导入失败" });
    } finally {
      setSaving(false);
    }
  };

  const filterButtons: { key: FilterType; label: string; icon: typeof Link2 }[] = [
    { key: "all", label: "全部", icon: Link2 },
    { key: "pending", label: "待审核", icon: Clock },
    { key: "approved", label: "已通过", icon: Check },
    { key: "rejected", label: "已拒绝", icon: X },
  ];

  return (
    <div className="mx-auto w-full max-w-[1120px] py-[32px]">
      <div className="mb-[24px] flex flex-col gap-[12px] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">友链管理</h1>
          <p className="mt-[4px] text-[13px] text-muted-foreground/40">审核申请、维护排序，并兼容旧社交链接</p>
        </div>
        <div className="flex flex-wrap items-center gap-[8px]">
          {message && (
            <span className={`rounded-md px-[10px] py-[6px] text-[12px] ${message.type === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
              {message.text}
            </span>
          )}
          <button
            type="button"
            onClick={importLegacy}
            disabled={saving}
            className="inline-flex h-[34px] items-center gap-[6px] rounded-md border border-border/25 px-[12px] text-[12px] text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          >
            <Download className="h-[13px] w-[13px]" />
            导入旧链接
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex h-[34px] items-center gap-[6px] rounded-md bg-foreground px-[12px] text-[12px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="h-[13px] w-[13px]" />
            新建
          </button>
        </div>
      </div>

      <div className="mb-[18px] grid grid-cols-2 gap-[8px] md:grid-cols-4">
        {filterButtons.map((item) => {
          const Icon = item.icon;
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-md border p-[14px] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "border-foreground/20 bg-card/30" : "border-border/25 bg-card/10 hover:bg-card/20"}`}
            >
              <div className="flex items-center gap-[8px]">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-foreground/[0.06]">
                  <Icon className="h-[13px] w-[13px] text-muted-foreground/70" />
                </span>
                <span>
                  <span className="block text-[18px] font-semibold leading-none">{counts[item.key]}</span>
                  <span className="mt-[2px] block text-[11px] text-muted-foreground/42">{item.label}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-[16px] lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-border/25">
          <div className="flex items-center justify-between border-b border-border/15 px-[14px] py-[10px]">
            <h2 className="text-[12px] font-medium text-muted-foreground/50">友链列表</h2>
            <span className="text-[11px] text-muted-foreground/30">{filteredLinks.length} 条</span>
          </div>
          {loading ? (
            <div className="space-y-[6px] p-[14px]">
              {[1, 2, 3].map((item) => <div key={item} className="h-[74px] animate-pulse rounded-md bg-card/15" />)}
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="py-[52px] text-center">
              <Link2 className="mx-auto mb-[10px] h-[20px] w-[20px] text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground/45">当前筛选下没有友链</p>
            </div>
          ) : (
            <div className="divide-y divide-border/12">
              {filteredLinks.map((link) => {
                const status = link.status || "pending";
                return (
                  <article key={link.id} className="group px-[14px] py-[12px] transition-colors hover:bg-card/10">
                    <div className="flex flex-col gap-[10px] md:flex-row md:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-[8px]">
                          <h3 className="max-w-[260px] truncate text-[14px] font-medium text-foreground">{link.name}</h3>
                          <Badge variant="outline" className={`h-[18px] rounded-[3px] px-[6px] text-[10px] font-normal ${STATUS_META[status].className}`}>
                            {STATUS_META[status].label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/30">{link.source === "submission" ? "申请" : link.source === "imported" ? "导入" : "手动"}</span>
                        </div>
                        <p className="mt-[6px] line-clamp-2 text-[12px] leading-[1.6] text-muted-foreground/62">{link.description || "无简介"}</p>
                        <div className="mt-[8px] flex flex-wrap items-center gap-x-[10px] gap-y-[4px] text-[11px] text-muted-foreground/32">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[260px] items-center gap-[4px] truncate hover:text-foreground/70">
                            <ExternalLink className="h-[10px] w-[10px] shrink-0" />
                            {link.url}
                          </a>
                          <span>排序 {link.sortOrder}</span>
                          <span>{formatDate(link.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-[2px] md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                        {status !== "approved" && (
                          <button type="button" onClick={() => runAction(link.id, "approve")} disabled={processing === link.id} title="通过" className="rounded-md p-[7px] text-muted-foreground/35 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500 disabled:opacity-40">
                            <Check className="h-[14px] w-[14px]" />
                          </button>
                        )}
                        {status !== "rejected" && (
                          <button type="button" onClick={() => runAction(link.id, "reject")} disabled={processing === link.id} title="拒绝" className="rounded-md p-[7px] text-muted-foreground/35 transition-colors hover:bg-amber-500/10 hover:text-amber-500 disabled:opacity-40">
                            <X className="h-[14px] w-[14px]" />
                          </button>
                        )}
                        <button type="button" onClick={() => setForm(toForm(link))} title="编辑" className="rounded-md p-[7px] text-muted-foreground/35 transition-colors hover:bg-muted/50 hover:text-foreground">
                          <Edit3 className="h-[14px] w-[14px]" />
                        </button>
                        <button type="button" onClick={() => runAction(link.id, "delete")} disabled={processing === link.id} title="删除" className="rounded-md p-[7px] text-muted-foreground/35 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40">
                          <Trash2 className="h-[14px] w-[14px]" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-md border border-border/25 bg-card/10">
          <div className="flex items-center justify-between border-b border-border/15 px-[14px] py-[10px]">
            <h2 className="text-[13px] font-medium">{form.id ? "编辑友链" : "新建友链"}</h2>
            {form.id && (
              <button type="button" onClick={resetForm} className="rounded-md p-[6px] text-muted-foreground/40 hover:bg-muted/50 hover:text-foreground" title="清空">
                <X className="h-[13px] w-[13px]" />
              </button>
            )}
          </div>
          <form className="space-y-[10px] p-[14px]" onSubmit={submit}>
            <input value={form.name} onChange={(e) => updateField("name", e.target.value)} className={inputClass} placeholder="站点名称" />
            <input value={form.url} onChange={(e) => updateField("url", e.target.value)} className={inputClass} placeholder="https://example.com" />
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
              className="w-full resize-y rounded-md border border-border/25 bg-background/30 px-[10px] py-[10px] text-[13px] leading-[1.7] text-foreground outline-none transition-colors placeholder:text-muted-foreground/30 focus:border-foreground/20"
              placeholder="简介"
            />
            <input value={form.avatarUrl} onChange={(e) => updateField("avatarUrl", e.target.value)} className={inputClass} placeholder="头像 URL" />
            <div className="grid grid-cols-2 gap-[8px]">
              <input value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} className={inputClass} placeholder="联系人" />
              <input value={form.ownerEmail} onChange={(e) => updateField("ownerEmail", e.target.value)} className={inputClass} placeholder="邮箱" />
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-[8px]">
              <select value={form.status} onChange={(e) => updateField("status", e.target.value as FriendLinkStatus)} className={inputClass}>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
              </select>
              <input type="number" value={form.sortOrder} onChange={(e) => updateField("sortOrder", Number(e.target.value) || 0)} className={inputClass} placeholder="排序" />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-[38px] w-full items-center justify-center gap-[8px] rounded-md bg-foreground text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-[14px] w-[14px]" />
              {saving ? "保存中..." : "保存"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
