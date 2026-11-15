import { useState } from "react";
import { LockKeyhole, LoaderCircle } from "lucide-react";
import { unlockPost, unlockSeries, ApiError, type LockInfo, type UnlockResult } from "@/lib/api";

type UnlockGateProps = {
  slug?: string;
  seriesSlug?: string;
  locks: LockInfo[];
  onUnlocked: () => void;
  title?: string;
};

/**
 * 文章 / 文档系列的密码门禁。
 * 密码提交到后端 /unlock 接口，成功后由后端下发 HttpOnly cookie；
 * 这里不保存密码，也不把解锁 token 写进 localStorage。
 */
export function UnlockGate({ slug, seriesSlug, locks, onUnlocked, title = "受保护的文章" }: UnlockGateProps) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(locks.length);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || submitting) return;

    setSubmitting(true);
    setError("");
    try {
      const result: UnlockResult = seriesSlug
        ? await unlockSeries(seriesSlug, password)
        : slug
          ? await unlockPost(slug, password)
          : { ok: false, fullyUnlocked: false, remaining: locks.length, expiresAt: "" };
      if (result.fullyUnlocked) {
        onUnlocked();
        return;
      }
      setRemaining(result.remaining);
      setPassword("");
      setError(`还需要 ${result.remaining} 个密码`);
    } catch (cause) {
      if (cause instanceof ApiError && ["not_locked", "post_not_found"].includes(cause.code || "")) {
        // 锁已被移除或文章已删除：重新加载，让页面回到公开内容或 404。
        onUnlocked();
        return;
      }
      const message = cause instanceof Error ? cause.message : "密码错误";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 items-center justify-center px-[16px] py-[64px]">
      <div className="w-full rounded-md border border-border/20 bg-background/28 p-[24px] sm:p-[32px]">
        <div className="mb-[18px] flex items-center gap-[10px]">
          <span className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-md border border-border/20 bg-card/30">
            <LockKeyhole className="h-[16px] w-[16px] text-muted-foreground/70" />
          </span>
          <div>
            <h1 className="font-heading text-[20px] font-semibold tracking-[-0.02em] text-foreground sm:text-[24px]">{title}</h1>
            <p className="mt-[2px] text-[12px] text-muted-foreground/55">
              {remaining > 1 ? `这篇文章需要 ${remaining} 个密码` : "这篇文章需要密码才能阅读"}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-[10px] sm:flex-row">
          <label className="sr-only" htmlFor="post-unlock-password">访问密码</label>
          <input
            id="post-unlock-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入访问密码"
            autoComplete="current-password"
            autoFocus
            disabled={submitting}
            className="h-[40px] min-w-0 flex-1 rounded-md border border-border/25 bg-background/40 px-[12px] text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/25 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!password || submitting}
            className="inline-flex h-[40px] items-center justify-center gap-[6px] rounded-md bg-foreground px-[16px] text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            {submitting && <LoaderCircle className="h-[14px] w-[14px] animate-spin" />}
            {submitting ? "验证中" : "解锁"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-[10px] text-[12px] text-destructive">
            {error}
          </p>
        )}

        <p className="mt-[16px] text-[11px] leading-[1.6] text-muted-foreground/40">
          密码只发送到本站后端验证，不会写入 URL 或本地存储。
        </p>
      </div>
    </div>
  );
}
