import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Trash2,
} from "lucide-react";
import {
  approveGuestbookMessage,
  deleteGuestbookMessage,
  fetchAdminGuestbookMessages,
  type GuestbookMessage,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";

type FilterType = "all" | "pending" | "approved";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminGuestbook() {
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [processing, setProcessing] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = "留言板 | Monolith";
    fetchAdminGuestbookMessages()
      .then((page) => {
        setMessages(page.items);
        setNextCursor(page.nextCursor);
        setNotice(null);
      })
      .catch(() => {
        setMessages([]);
        setNotice({ type: "error", text: "留言加载失败，请稍后重试。" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchAdminGuestbookMessages(nextCursor);
      setMessages((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setNotice(null);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "更多留言加载失败" });
    } finally {
      setLoadingMore(false);
    }
  };

  const counts = useMemo(() => ({
    all: messages.length,
    pending: messages.filter((message) => !message.approved).length,
    approved: messages.filter((message) => message.approved).length,
  }), [messages]);

  const filteredMessages = useMemo(() => {
    const list = messages.filter((message) => {
      if (filter === "pending") return !message.approved;
      if (filter === "approved") return message.approved;
      return true;
    });
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filter, messages]);

  const handleApprove = async (id: number) => {
    setProcessing(id);
    try {
      await approveGuestbookMessage(id);
      setMessages((prev) => prev.map((message) => (
        message.id === id ? { ...message, approved: true } : message
      )));
      setNotice({ type: "success", text: "留言已通过" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "审核失败" });
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除这条留言？此操作不可撤销。")) return;
    setProcessing(id);
    try {
      await deleteGuestbookMessage(id);
      setMessages((prev) => prev.filter((message) => message.id !== id));
      setNotice({ type: "success", text: "留言已删除" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "删除失败" });
    } finally {
      setProcessing(null);
    }
  };

  const filterButtons: { key: FilterType; label: string; icon: typeof MessageCircle }[] = [
    { key: "all", label: "全部", icon: MessageCircle },
    { key: "pending", label: "待审核", icon: Clock },
    { key: "approved", label: "已通过", icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto w-full max-w-[960px] py-[32px]">
      <div className="mb-[24px] flex flex-col gap-[12px] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-semibold">留言板</h1>
          <p className="mt-[4px] text-[13px] text-muted-foreground/40">审核公开留言，处理访客反馈</p>
        </div>
        {notice && (
          <span role="status" aria-live="polite" className={`w-fit rounded-md px-[10px] py-[6px] text-[12px] ${notice.type === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
            {notice.text}
          </span>
        )}
      </div>

      <div className="mb-[20px] grid grid-cols-3 gap-[10px]">
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
                <span className="flex h-[32px] w-[32px] items-center justify-center rounded-md bg-foreground/[0.06]">
                  <Icon className="h-[14px] w-[14px] text-muted-foreground/70" />
                </span>
                <span>
                  <span className="block text-[20px] font-semibold leading-none">{counts[item.key]}</span>
                  <span className="mt-[2px] block text-[11px] text-muted-foreground/42">{item.label}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-[8px] flex items-center justify-between">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground/40">
          {filter === "all" ? "所有留言" : filter === "pending" ? "待审核" : "已通过"}
        </h2>
        <span className="text-[11px] text-muted-foreground/25">{filteredMessages.length} 条</span>
      </div>

      {loading ? (
        <div className="space-y-[6px]">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-[86px] animate-pulse rounded-md bg-card/15" />
          ))}
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/25 py-[48px] text-center">
          <MessageCircle className="mx-auto mb-[10px] h-[20px] w-[20px] text-muted-foreground/20" />
          <p className="text-[13px] text-muted-foreground/40">
            {filter === "pending" ? "没有待审核留言" : filter === "approved" ? "没有已通过留言" : "还没有留言"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/25">
          {filteredMessages.map((message, index) => (
            <article
              key={message.id}
              className={`group px-[18px] py-[14px] transition-colors hover:bg-card/15 ${index < filteredMessages.length - 1 ? "border-b border-border/12" : ""}`}
            >
              <div className="flex items-start gap-[12px]">
                <div className={`mt-[4px] h-[8px] w-[8px] shrink-0 rounded-full ${message.approved ? "bg-emerald-400/60" : "animate-pulse bg-amber-400/60"}`} />
                <div className="min-w-0 flex-1">
                  <div className="mb-[6px] flex flex-wrap items-center gap-[8px]">
                    <span className="text-[13px] font-medium text-foreground">{message.authorName}</span>
                    {message.authorEmail && (
                      <span className="inline-flex max-w-[220px] items-center gap-[4px] truncate text-[11px] text-muted-foreground/35">
                        <Mail className="h-[10px] w-[10px] shrink-0" />
                        {message.authorEmail}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={`h-[18px] rounded-[3px] px-[6px] text-[10px] font-normal ${
                        message.approved
                          ? "border-emerald-400/20 text-emerald-500"
                          : "border-amber-400/20 text-amber-500"
                      }`}
                    >
                      {message.approved ? "已通过" : "待审核"}
                    </Badge>
                  </div>
                  <p className="mb-[8px] whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-muted-foreground/72">
                    {message.content}
                  </p>
                  <span className="text-[11px] text-muted-foreground/30">{formatDate(message.createdAt)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-[2px] md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                  {!message.approved && (
                    <button
                      type="button"
                      onClick={() => handleApprove(message.id)}
                      disabled={processing === message.id}
                      title="通过审核"
                      aria-label={`通过 ${message.authorName} 的留言`}
                      className="flex h-[44px] w-[44px] items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-40 dark:hover:text-emerald-400 md:h-[36px] md:w-[36px]"
                    >
                      <Check className="h-[14px] w-[14px]" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(message.id)}
                    disabled={processing === message.id}
                    title="删除"
                    aria-label={`删除 ${message.authorName} 的留言`}
                    className="flex h-[44px] w-[44px] items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40 dark:hover:text-red-400 md:h-[36px] md:w-[36px]"
                  >
                    <Trash2 className="h-[14px] w-[14px]" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && nextCursor && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void handleLoadMore()}
          className="mt-[12px] inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-border/25 text-[13px] text-muted-foreground/70 transition-colors hover:bg-card/20 hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {loadingMore ? "加载中..." : "加载更多留言"}
        </button>
      )}
    </div>
  );
}
