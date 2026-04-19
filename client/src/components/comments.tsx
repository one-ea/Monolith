import { useEffect, useState, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { fetchComments, submitComment, type CommentData } from "@/lib/api";
import { MessageCircle, Send, User, ChevronDown, ChevronUp } from "lucide-react";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** 通过昵称生成 DiceBear 头像 URL（不再传输邮箱） */
function avatarUrl(name: string, size = 40): string {
  const seed = encodeURIComponent(name.trim() || "U");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&size=${size}`;
}

/* ── 单条评论 ──────────────────────────── */
function CommentItem({ comment }: { comment: CommentData }) {
  return (
    <div className="group flex gap-[12px] py-[16px]">
      <div className="shrink-0">
        <img
          src={avatarUrl(comment.authorName)}
          alt={comment.authorName}
          className="h-[36px] w-[36px] rounded-full bg-card/30 ring-1 ring-border/20"
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-[8px] mb-[4px]">
          <span className="text-[14px] font-medium text-foreground">{comment.authorName}</span>
          <span className="text-[12px] text-muted-foreground/50">{formatDate(comment.createdAt)}</span>
        </div>
        <p className="text-[14px] leading-[1.7] text-muted-foreground/80 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
    </div>
  );
}

/* ── 评论表单 ──────────────────────────── */
function CommentForm({ slug, onSubmitted }: { slug: string; onSubmitted: () => void }) {
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await submitComment(slug, {
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || undefined,
        content: content.trim(),
      });
      if (result.success) {
        setMessage({ type: "success", text: result.message || "评论已提交，等待审核" });
        setContent("");
        onSubmitted();
      } else {
        setMessage({ type: "error", text: result.error || "提交失败" });
      }
    } catch {
      setMessage({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-md border border-border/40 bg-card/20 px-[12px] py-[8px] text-[14px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-[12px]">
      <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
        <div>
          <label htmlFor="comment-name" className="mb-[4px] block text-[12px] font-medium text-muted-foreground/60">
            昵称 <span className="text-red-400">*</span>
          </label>
          <input
            id="comment-name"
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="你的昵称"
            className={inputClass}
            maxLength={50}
            required
          />
        </div>
        <div>
          <label htmlFor="comment-email" className="mb-[4px] block text-[12px] font-medium text-muted-foreground/60">
            邮箱 <span className="text-muted-foreground/30">（可选，用于头像）</span>
          </label>
          <input
            id="comment-email"
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="name@example.com"
            className={inputClass}
            maxLength={100}
          />
        </div>
      </div>

      {/* Honeypot 反垃圾 — 对用户不可见 */}
      <input type="text" name="_hp" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

      <div>
        <label htmlFor="comment-content" className="mb-[4px] block text-[12px] font-medium text-muted-foreground/60">
          评论 <span className="text-red-400">*</span>
        </label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写下你的想法..."
          className={`${inputClass} min-h-[100px] resize-y`}
          maxLength={2000}
          required
        />
        <div className="mt-[4px] text-right text-[11px] text-muted-foreground/30">
          {content.length}/2000
        </div>
      </div>

      {message && (
        <div className={`rounded-md px-[12px] py-[8px] text-[13px] ${
          message.type === "success"
            ? "bg-green-500/10 text-green-400 border border-green-500/20"
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !authorName.trim() || !content.trim()}
        className="inline-flex items-center gap-[6px] rounded-md bg-blue-600/80 px-[16px] py-[8px] text-[13px] font-medium text-white transition-all duration-200 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send className="h-[14px] w-[14px]" />
        {submitting ? "提交中..." : "发表评论"}
      </button>
    </form>
  );
}

/* ── 评论区主组件 ──────────────────────── */
export function CommentsSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // 初次仍然加载以获取评论数量
  const loadComments = useCallback(() => {
    fetchComments(slug)
      .then(setComments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  return (
    <section className="mt-[40px] animate-fade-in delay-5">
      <div className="rounded-xl border border-border/40 bg-card/10 overflow-hidden transition-all duration-300">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-[16px] md:px-[20px] bg-transparent hover:bg-card/30 transition-colors"
          title={isOpen ? "收起评论区" : "展开评论区"}
        >
          <div className="flex items-center gap-[8px]">
            <MessageCircle className="h-[18px] w-[18px] text-muted-foreground/60" />
            <h2 className="text-[16px] font-semibold text-foreground">
              评论区{!loading && comments.length > 0 && <span className="ml-[6px] text-[14px] font-normal text-muted-foreground/50">({comments.length})</span>}
            </h2>
          </div>
          <div className="flex items-center gap-[6px] text-[13px] text-muted-foreground/50">
            {isOpen ? (
              <>
                <span className="hidden sm:inline">收起评论</span>
                <ChevronUp className="h-[16px] w-[16px]" />
              </>
            ) : (
              <>
                <span className="hidden sm:inline">
                  {loading ? "加载中..." : comments.length > 0 ? "点击展开" : "留个言吧"}
                </span>
                <ChevronDown className="h-[16px] w-[16px]" />
              </>
            )}
          </div>
        </button>

        {/* 展开内容区域 */}
        {isOpen && (
          <div className="animate-fade-in-down border-t border-border/20 p-[16px] md:px-[20px] md:pb-[24px]">
            {/* 评论列表 */}
            {loading ? (
              <div className="space-y-[12px]">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-[12px]">
                    <div className="h-[36px] w-[36px] rounded-full bg-card/30 animate-pulse" />
                    <div className="flex-1 space-y-[6px]">
                      <div className="h-[14px] w-[120px] rounded bg-card/20 animate-pulse" />
                      <div className="h-[14px] w-full rounded bg-card/20 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length > 0 ? (
              <div className="divide-y divide-border/20">
                {comments.map((c) => (
                  <CommentItem key={c.id} comment={c} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-[24px] text-center">
                <User className="h-[32px] w-[32px] text-muted-foreground/20 mb-[8px]" />
                <p className="text-[14px] text-muted-foreground/40">还没有评论，来做第一个留言的人吧</p>
              </div>
            )}

            <Separator className="my-[24px] bg-border/20" />

            {/* 评论表单 */}
            <h3 className="mb-[12px] text-[14px] font-medium text-muted-foreground/60">发表评论</h3>
            <CommentForm slug={slug} onSubmitted={loadComments} />
          </div>
        )}
      </div>
    </section>
  );
}
