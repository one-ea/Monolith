import { FormEvent, useCallback, useEffect, useState } from "react";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import {
  fetchGuestbookMessages,
  submitGuestbookMessage,
  type GuestbookMessage,
} from "@/lib/api";
import { useSiteSettings } from "@/lib/site-settings";
import { formatSiteDate } from "@/lib/date-format";

type FormState = {
  authorName: string;
  authorEmail: string;
  content: string;
  hp: string;
};

const EMPTY_FORM: FormState = {
  authorName: "",
  authorEmail: "",
  content: "",
  hp: "",
};

const inputClass = "h-[42px] w-full rounded-md border border-border/25 bg-background/35 px-[12px] text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/35 focus:border-foreground/25";

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "M";
}

export function GuestbookPage() {
  const { dateSettings } = useSiteSettings();
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadMessages = useCallback(async (before?: number) => {
    before ? setLoadingMore(true) : setLoading(true);
    setLoadError(false);
    try {
      const page = await fetchGuestbookMessages(before);
      setMessages((current) => before ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      before ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "留言板 | Monolith";
    void loadMessages();
  }, [loadMessages]);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if (!form.authorName.trim() || !form.content.trim()) {
      setNotice({ type: "error", text: "请填写昵称和留言内容" });
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitGuestbookMessage({
        authorName: form.authorName.trim(),
        authorEmail: form.authorEmail.trim() || undefined,
        content: form.content.trim(),
        _hp: form.hp,
      });

      if (result.success) {
        setForm(EMPTY_FORM);
        setNotice({ type: "success", text: result.message || "留言已提交，等待审核" });
      } else {
        setNotice({ type: "error", text: result.error || "提交失败" });
      }
    } catch {
      setNotice({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] px-[16px] py-[32px] lg:px-0 lg:py-[56px]">
      <SeoHead
        title="留言板"
        description="在 Monolith 留下问候、反馈或想说的话。"
        url="/guestbook"
      />

      <div className="mb-[28px]">
        <div className="mb-[10px] inline-flex items-center gap-[6px] rounded-md border border-border/25 bg-background/35 px-[10px] py-[6px] text-[12px] text-muted-foreground/70">
          <Sparkles className="h-[13px] w-[13px]" />
          Guestbook
        </div>
        <h1 className="text-[28px] font-semibold text-foreground">留言板</h1>
        <p className="mt-[8px] max-w-[620px] text-[14px] leading-[1.8] text-muted-foreground/68">
          可以在这里留下问候、反馈或想交流的话。留言会先进入审核，公开展示时不会暴露邮箱。
        </p>
      </div>

      <div className="grid gap-[24px] lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-[10px] flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-muted-foreground/60">公开留言</h2>
            <span className="text-[12px] text-muted-foreground/50">已加载 {messages.length} 条</span>
          </div>

          {loading ? (
            <div className="space-y-[10px]">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-[104px] animate-pulse rounded-md border border-border/20 bg-card/15" />
              ))}
            </div>
          ) : loadError && messages.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/30 px-[18px] py-[48px] text-center">
              <MessageCircle className="mx-auto mb-[10px] h-[22px] w-[22px] text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground/70">留言加载失败，请检查网络后重试</p>
              <button
                type="button"
                onClick={() => void loadMessages()}
                className="mt-[12px] inline-flex min-h-[44px] items-center justify-center rounded-md border border-border/30 px-[16px] text-[13px] text-foreground transition-colors hover:bg-card/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                重新加载
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/25 px-[18px] py-[48px] text-center">
              <MessageCircle className="mx-auto mb-[10px] h-[22px] w-[22px] text-muted-foreground/24" />
              <p className="text-[13px] text-muted-foreground/55">暂时还没有公开留言</p>
            </div>
          ) : (
            <div className="space-y-[10px]">
              {messages.map((message) => (
                <article key={message.id} className="rounded-md border border-border/25 bg-card/10 p-[14px]">
                  <div className="flex items-start gap-[12px]">
                    <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-md border border-border/20 bg-background/40 text-[15px] font-semibold text-muted-foreground/70">
                      {getInitial(message.authorName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-[8px] gap-y-[2px]">
                        <h3 className="text-[14px] font-medium text-foreground">{message.authorName}</h3>
                        <span className="text-[12px] text-muted-foreground/38">{formatSiteDate(message.createdAt, dateSettings)}</span>
                      </div>
                      <p className="mt-[8px] whitespace-pre-wrap break-words text-[13px] leading-[1.8] text-muted-foreground/72">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
              {nextCursor && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMessages(nextCursor)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-border/25 text-[13px] text-muted-foreground/70 transition-colors hover:bg-card/20 hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {loadingMore ? "加载中..." : "加载更多留言"}
                </button>
              )}
              {loadError && messages.length > 0 && (
                <p role="alert" className="text-center text-[12px] text-red-500">更多留言加载失败，请重试</p>
              )}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-md border border-border/25 bg-card/10 p-[16px]">
          <h2 className="mb-[12px] text-[14px] font-medium text-foreground">写留言</h2>
          <form className="space-y-[10px]" onSubmit={submit}>
            <input
              id="guestbook-author-name"
              aria-label="昵称"
              required
              value={form.authorName}
              onChange={(event) => updateField("authorName", event.target.value)}
              className={inputClass}
              placeholder="昵称"
              maxLength={50}
            />
            <input
              id="guestbook-author-email"
              aria-label="邮箱（可选）"
              value={form.authorEmail}
              onChange={(event) => updateField("authorEmail", event.target.value)}
              className={inputClass}
              placeholder="邮箱，可选"
              maxLength={100}
              type="email"
            />
            <input
              aria-hidden="true"
              value={form.hp}
              onChange={(event) => updateField("hp", event.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />
            <textarea
              id="guestbook-content"
              aria-label="留言内容"
              required
              value={form.content}
              onChange={(event) => updateField("content", event.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-border/25 bg-background/35 px-[12px] py-[10px] text-[13px] leading-[1.7] text-foreground outline-none transition-colors placeholder:text-muted-foreground/35 focus:border-foreground/25"
              placeholder="写下想说的话..."
              maxLength={2000}
            />
            <div className="text-right text-[11px] text-muted-foreground/30">{form.content.length}/2000</div>
            {notice && (
              <div role="status" aria-live="polite" className={`rounded-md border px-[12px] py-[10px] text-[12px] ${notice.type === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                {notice.text}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !form.authorName.trim() || !form.content.trim()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-[8px] rounded-md bg-foreground px-[14px] text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-[14px] w-[14px]" />
              {submitting ? "提交中..." : "提交留言"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
