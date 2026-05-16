import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  fetchAdminComments, approveComment, deleteComment,
  type AdminComment,
} from "@/lib/api";
import {
  Check, Trash2, MessageCircle, Clock, CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type FilterType = "all" | "pending" | "approved";

export function AdminComments() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [processing, setProcessing] = useState<number | null>(null);
  const [error, setError] = useState("");

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
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此评论？此操作不可撤销。")) return;
    setProcessing(id);
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = comments.filter((c) => !c.approved).length;
  const approvedCount = comments.filter((c) => c.approved).length;

  const filteredComments = comments.filter((c) => {
    if (filter === "pending") return !c.approved;
    if (filter === "approved") return c.approved;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-[960px] py-[32px]">
      {/* ─── 顶栏 ─── */}
      <div className="mb-[24px] flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">互动审核</h1>
          <p className="mt-[3px] text-[13px] text-muted-foreground/40">处理互动反馈、可见状态与内容质量</p>
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
                    <span>{formatDate(comment.createdAt)}</span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-[1px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!comment.approved && (
                    <button
                      onClick={() => handleApprove(comment.id)}
                      disabled={processing === comment.id}
                      title="通过审核"
                      className="p-[7px] rounded-md text-muted-foreground/30 hover:text-emerald-400 hover:bg-emerald-400/8 transition-colors disabled:opacity-30"
                    >
                      <Check className={`h-[14px] w-[14px] ${processing === comment.id ? "animate-pulse" : ""}`} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={processing === comment.id}
                    title="删除"
                    className="p-[7px] rounded-md text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/8 transition-colors disabled:opacity-30"
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
