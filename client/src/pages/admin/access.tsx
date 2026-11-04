import { useEffect, useState } from "react";
import { LockKeyhole, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import {
  fetchContentLocks,
  setContentLock,
  type ContentLock,
  type ContentLockKind,
} from "@/lib/api";

const KIND_LABEL: Record<ContentLockKind, string> = {
  post: "文章",
  tag: "标签",
  category: "分类",
  series: "系列",
};

const KIND_PLACEHOLDER: Record<ContentLockKind, string> = {
  post: "文章 slug，例如 hello-world",
  tag: "标签名，例如 前端",
  category: "分类名，例如 技术",
  series: "系列 slug，例如 react-tutorial",
};

export function AdminAccess() {
  const [locks, setLocks] = useState<ContentLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<ContentLockKind>("tag");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" as "" | "success" | "error" });

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      setLocks(await fetchContentLocks());
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = name.trim();
    if (!target || !password) {
      showMessage("请填写名称和密码", "error");
      return;
    }

    setSaving(true);
    try {
      await setContentLock(kind, target, password);
      setName("");
      setPassword("");
      showMessage("已设置访问密码", "success");
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (lock: ContentLock) => {
    if (!window.confirm(`确定移除「${lock.name}」的访问密码吗？`)) return;
    setSaving(true);
    try {
      await setContentLock(lock.kind, lock.name, null);
      showMessage("已移除访问密码", "success");
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "移除失败", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[980px] px-[16px] py-[28px] sm:px-[24px] lg:px-[32px]">
      <header className="mb-[20px] flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/45">Access Control</p>
          <h1 className="mt-[4px] flex items-center gap-[8px] font-heading text-[24px] font-semibold tracking-[-0.03em]">
            <LockKeyhole className="h-[20px] w-[20px]" />访问控制
          </h1>
          <p className="mt-[6px] text-[12px] text-muted-foreground/55">为文章、标签、分类或系列设置一次性密码；读者需要密码才能阅读受保护内容。</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-[34px] items-center gap-[6px] rounded-md border border-border/25 bg-background/30 px-[10px] text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className={`h-[13px] w-[13px] ${loading ? "animate-spin" : ""}`} />刷新
        </button>
      </header>

      <form onSubmit={submit} className="mb-[20px] rounded-md border border-border/20 bg-background/25 p-[16px]">
        <div className="grid gap-[10px] sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-[4px]">
            <span className="text-[10px] uppercase tracking-normal text-muted-foreground/60">类型</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as ContentLockKind)}
              className="h-[36px] rounded-md border border-border/25 bg-background/40 px-[8px] text-[12px] text-foreground outline-none focus:border-foreground/25"
            >
              {(Object.keys(KIND_LABEL) as ContentLockKind[]).map((value) => (
                <option key={value} value={value}>{KIND_LABEL[value]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[10px] uppercase tracking-normal text-muted-foreground/60">名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={KIND_PLACEHOLDER[kind]}
              className="h-[36px] rounded-md border border-border/25 bg-background/40 px-[10px] text-[12px] text-foreground outline-none placeholder:text-muted-foreground/45 focus:border-foreground/25"
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[10px] uppercase tracking-normal text-muted-foreground/60">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="设置后立即生效"
              autoComplete="new-password"
              className="h-[36px] rounded-md border border-border/25 bg-background/40 px-[10px] text-[12px] text-foreground outline-none placeholder:text-muted-foreground/45 focus:border-foreground/25"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="mt-[18px] inline-flex h-[36px] items-center justify-center gap-[6px] rounded-md bg-foreground px-[14px] text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving && <LoaderCircle className="h-[13px] w-[13px] animate-spin" />}
            保存
          </button>
        </div>
        {message.text && (
          <p className={`mt-[10px] text-[12px] ${message.type === "error" ? "text-destructive" : "text-emerald-500"}`}>{message.text}</p>
        )}
      </form>

      <div className="overflow-hidden rounded-md border border-border/20 bg-background/25">
        <div className="grid grid-cols-[90px_minmax(0,1fr)_120px_80px] gap-[10px] border-b border-border/15 px-[14px] py-[10px] text-[10px] uppercase tracking-normal text-muted-foreground/45">
          <span>类型</span><span>名称</span><span>更新时间</span><span className="text-right">操作</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-[40px] text-[12px] text-muted-foreground/50">
            <LoaderCircle className="mr-[6px] h-[14px] w-[14px] animate-spin" />加载中
          </div>
        ) : locks.length === 0 ? (
          <div className="py-[40px] text-center text-[12px] text-muted-foreground/45">还没有设置任何访问密码</div>
        ) : (
          locks.map((lock) => (
            <div key={`${lock.kind}:${lock.name}`} className="grid grid-cols-[90px_minmax(0,1fr)_120px_80px] items-center gap-[10px] border-b border-border/10 px-[14px] py-[10px] last:border-b-0">
              <span className="text-[11px] text-muted-foreground/60">{KIND_LABEL[lock.kind]}</span>
              <span className="truncate font-mono text-[12px] text-foreground/80">{lock.name}</span>
              <span className="text-[11px] text-muted-foreground/45">{new Date(lock.updatedAt).toLocaleDateString("zh-CN")}</span>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void remove(lock)}
                  disabled={saving}
                  aria-label={`移除 ${lock.name} 的密码`}
                  className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-[13px] w-[13px]" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
