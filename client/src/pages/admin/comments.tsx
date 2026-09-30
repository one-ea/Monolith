import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  fetchAdminComments, approveComment, deleteComment, replyToComment,
  type AdminComment,
} from "@/lib/api";
import {
  Check, Trash2, MessageCircle, Clock, CheckCircle2,
  ExternalLink, Reply,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSiteSettings } from "@/lib/site-settings";
import { removeCommentThread } from "@/lib/comments-state";
import { formatSiteDate } from "@/lib/date-format";

type FilterType = "all" | "pending" | "approved";

/** 审核队列中的回复上下文：标注回复对象，父评论已删时提示悬挂引用 */
function ReplyContext({ parentId, commentsById }: { parentId: number | null; commentsById: Map<number, AdminComment> }) {
  if (parentId == null) return null;
  const parent = commentsById.get(parentId);
  return (
    <span className="text-[11px] text-muted-foreground/35">
      {parent ? `回复 ${parent.authorName}` : "父评论已删除"}
    </span>
  );
}

export function AdminComments() {
  const { dateSettings } = useSiteSettings();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [processing, setProcessing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");

  useEffect(() => {
    document.title = "互动审核 | Monolith";
    fetchAdminComments()
      .then((data) => {
        setComments(data);
        setError("");
      })
      .catch(() => {
        setComments([]);
        setError("评论加载失败，请稍后重试。");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: number) => {
    setProcessing(id);
    try {
      await approveComment(id);
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, approved: true } : c))
      );
      setError("");
    } catch (err) {
      console.error(err);
      setError("审核操作失败，请稍后重试。");
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此评论及其所有后代回复？此操作不可撤销。")) return;
    setProcessing(id);
    try {
      await deleteComment(id);
      setComments((prev) => removeCommentThread(prev, id));
      setError("");
    } catch (err) {
      console.error(err);
      setError("删除失败，请稍后重试。");
    } finally {
      setProcessing(null);
    }
  };

  const handleReply = async (comment: AdminComment) => {
    if (!replyContent.trim()) return;
    setProcessing(comment.id);
    try {
      const reply = await replyToComment(comment.id, { content: replyContent.trim() });
      // 列表为最新在前（created_at DESC），新回复插到开头
      setComments((prev) => [{ ...reply, authorEmail: "", postSlug: comment.postSlug, postTitle: comment.postTitle }, ...prev]);
      setReplyContent(""); setReplyingTo(null);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "回复失败"); }
    finally { setProcessing(null); }
  };

  const pendingCount = comments.filter((c) => !c.approved).length;
  const approvedCount = comments.filter((c) => c.approved).length;

  const filteredComments = comments.filter((c) => {
    if (filter === "pending") return !c.approved;
    if (filter === "approved") return c.approved;
    return true;
  });

  const commentsById = new Map(comments.map((c) => [c.id, c] as const));

  return (
    <div className="mx-auto w-full max-w-[960px] py-[32px]">
      {/* ─── 顶栏 ─── */}
      <div className="mb-[24px] flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">互动审核</h1>
          <p className="mt-[3px] text-[13px] text-muted-foreground/40">审核公开评论与嵌套回复；博主回复会立即公开</p>
        </div>
      </div>

      {error && (
        <div className="mb-[16px] rounded-lg border border-red-500/20 bg-red-500/10 px-[14px] py-[10px] text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* ─── 统计卡片 ─── */}
      <div className="mb-[20px] grid grid-cols-3 gap-[10px]">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-md border p-[16px] text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${filter === "all" ? "border-foreground/20 bg-card/30" : "border-border/25 bg-card/10 hover:bg-card/20"}`}
        >
          <div className="flex items-center gap-[8px]">
            <div className="flex h-[32px] w-[32px] items-center justify-center rounded-md bg-foreground/[0.06]">
              <MessageCircle className="h-[14px] w-[14px] text-foreground/62" />
            </div>
            <div>
              <p className="text-[20px] font-semibold leading-none">{comments.length}</p>
              <p className="text-[11px] text-muted-foreground/40 mt-[2px]">全部</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`rounded-md border p-[16px] text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${filter === "pending" ? "border-foreground/20 bg-card/30" : "border-border/25 bg-card/10 hover:bg-card/20"}`}
        >
          <div className="flex items-center gap-[8px]">
            <div className="flex h-[32px] w-[32px] items-center justify-center rounded-md bg-amber-500/10">
              <Clock className="h-[14px] w-[14px] text-amber-400" />
            </div>
            <div>
              <p className="text-[20px] font-semibold leading-none">{pendingCount}</p>
              <p className="text-[11px] text-muted-foreground/40 mt-[2px]">待审核</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setFilter("approved")}
          className={`rounded-md border p-[16px] text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${filter === "approved" ? "border-foreground/20 bg-card/30" : "border-border/25 bg-card/10 hover:bg-card/20"}`}
        >
          <div className="flex items-center gap-[8px]">
            <div className="flex h-[32px] w-[32px] items-center justify-center rounded-md bg-emerald-500/10">
              <CheckCircle2 className="h-[14px] w-[14px] text-emerald-400" />
            </div>
            <div>
              <p className="text-[20px] font-semibold leading-none">{approvedCount}</p>
              <p className="text-[11px] text-muted-foreground/40 mt-[2px]">已通过</p>
            </div>
          </div>
        </button>
      </div>

      {/* ─── 评论列表 ─── */}
      <div className="mb-[8px] flex items-center justify-between">
        <h2 className="text-[12px] font-medium text-muted-foreground/40 uppercase tracking-[0.06em]">
          {filter === "all" ? "所有评论" : filter === "pending" ? "待审核" : "已通过"}
        </h2>
        <span className="text-[11px] text-muted-foreground/25">{filteredComments.length} 条</span>
      </div>

      {loading ? (
        <div className="space-y-[6px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[80px] animate-pulse rounded-lg bg-card/15" />
          ))}
        </div>
      ) : filteredComments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/25 py-[48px] text-center">
          <MessageCircle className="mx-auto mb-[10px] h-[20px] w-[20px] text-muted-foreground/20" />
          <p className="text-[13px] text-muted-foreground/40">
            {filter === "pending" ? "没有待审核的评论" : filter === "approved" ? "没有已通过的评论" : "还没有评论"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/25 overflow-hidden">
          {filteredComments.map((comment, i) => (
            <div
              key={comment.id}
              className={`group px-[18px] py-[14px] ${i < filteredComments.length - 1 ? "border-b border-border/12" : ""} hover:bg-card/15 transition-colors`}
            >
              <div className="flex items-start gap-[12px]">
                {/* 状态指示 */}
                <div className={`mt-[4px] h-[8px] w-[8px] rounded-full shrink-0 ${comment.approved ? "bg-emerald-400/60" : "bg-amber-400/60 animate-pulse"}`} />

                <div className="flex-1 min-w-0">
                  {/* 头部信息 */}
                  <div className="flex items-center gap-[8px] mb-[4px]">
                    <span className="text-[13px] font-medium text-foreground">{comment.authorName}</span>
                    {comment.isAdmin && (
                      <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-[7px] py-[1px] text-[10px] font-semibold text-primary">
                        博主
                      </span>
                    )}
                    <ReplyContext parentId={comment.parentId} commentsById={commentsById} />
                    {comment.authorEmail && (
                      <span className="text-[11px] text-muted-foreground/30 truncate max-w-[200px]">{comment.authorEmail}</span>
                    )}
                    <Badge
                      variant="outline"
                      className={`h-[16px] rounded-[3px] px-[5px] text-[9px] font-normal ${
                        comment.approved
                          ? "text-emerald-400/70 border-emerald-400/20"
                          : "text-amber-400/70 border-amber-400/20"
                      }`}
                    >
                      {comment.approved ? "已通过" : "待审核"}
                    </Badge>
                  </div>

                  {/* 评论内容 */}
                  <p className="text-[13px] leading-[1.6] text-muted-foreground/70 whitespace-pre-wrap break-words mb-[6px]">
                    {comment.content}
                  </p>

                  {replyingTo === comment.id && (
                    <div className="mb-[8px] flex gap-[6px]">
                      <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="以博主身份回复（直接公开）" aria-label="回复内容" maxLength={2000} className="min-h-[72px] flex-1 rounded-md border border-border/30 bg-background/50 px-[10px] py-[8px] text-[13px]" />
                      <button onClick={() => handleReply(comment)} disabled={!replyContent.trim() || processing === comment.id} className="min-h-[36px] self-end rounded-md bg-foreground px-[10px] py-[7px] text-[12px] text-background disabled:opacity-40">发送</button>
                    </div>
                  )}
                  {/* 底部：文章链接 + 时间 */}
                  <div className="flex items-center gap-[8px] text-[11px] text-muted-foreground/30">
                    <Link
                      href={`/posts/${comment.postSlug}`}
                      className="inline-flex items-center gap-[3px] hover:text-foreground/60 transition-colors"
                    >
                      <ExternalLink className="h-[10px] w-[10px]" />
                      {comment.postTitle}
                    </Link>
                    <span className="text-border/40">·</span>
                    <span>{formatSiteDate(comment.createdAt, dateSettings)}</span>
                  </div>
                </div>

                {/* 操作按钮：触屏常驻；仅在支持 hover 的指针上隐藏到悬停/聚焦时 */}
                <div className="flex items-center gap-[4px] shrink-0 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                  {comment.approved && (
                    <button onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyContent(""); }} title="回复" aria-label="回复" className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground/30 hover:text-foreground">
                      <Reply className="h-[14px] w-[14px]" />
                    </button>
                  )}
                  {!comment.approved && (
                    <button
                      onClick={() => handleApprove(comment.id)}
                      disabled={processing === comment.id}
                      title="通过审核"
                      aria-label="通过审核"
                      className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground/30 hover:text-emerald-400 hover:bg-emerald-400/8 transition-colors disabled:opacity-30"
                    >
                      <Check className={`h-[14px] w-[14px] ${processing === comment.id ? "animate-pulse" : ""}`} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={processing === comment.id}
                    title="删除"
                    aria-label="删除"
                    className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/8 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className={`h-[13px] w-[13px] ${processing === comment.id ? "animate-pulse" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
