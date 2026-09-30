import { useEffect, useState, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { fetchComments, submitComment, checkAuth, type CommentData } from "@/lib/api";
import { buildCommentForest, commentIndentStep, type CommentTreeNode } from "@/lib/comments-state";
import { MessageCircle, Reply, Send, User, ChevronDown, ChevronUp } from "lucide-react";
import { useSiteSettings } from "@/lib/site-settings";
import { formatSiteDate } from "@/lib/date-format";

function avatarUrl(name: string, size = 40): string {
  const seed = encodeURIComponent(name.trim() || "U");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&size=${size}`;
}

type CommentFormProps = {
  slug: string;
  parent?: CommentData;
  isAdminLoggedIn?: boolean;
  onSubmitted: () => void;
  onCancel?: () => void;
};

function CommentForm({ slug, parent, isAdminLoggedIn, onSubmitted, onCancel }: CommentFormProps) {
  const [authorName, setAuthorName] = useState(isAdminLoggedIn ? "博主" : "");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fieldSuffix = parent ? `-${parent.id}` : "";

  useEffect(() => {
    if (isAdminLoggedIn && !authorName) {
      setAuthorName("博主");
    }
  }, [isAdminLoggedIn]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const finalAuthor = isAdminLoggedIn ? (authorName.trim() || "博主") : authorName.trim();
    if (!finalAuthor || !content.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await submitComment(slug, {
        authorName: finalAuthor,
        authorEmail: isAdminLoggedIn ? undefined : (authorEmail.trim() || undefined),
        content: content.trim(),
        parentId: parent?.id,
      });
      if (result.success) {
        const defaultMsg = isAdminLoggedIn 
          ? (parent ? "回复已发布" : "评论已发布")
          : (parent ? "回复已提交，审核通过后公开" : "评论已提交，等待审核");
        setMessage({ type: "success", text: result.message || defaultMsg });
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

  const inputClass = "w-full rounded-md border border-border/40 bg-card/20 px-[12px] py-[8px] text-[14px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-foreground/35 focus:ring-1 focus:ring-foreground/12";
  return (
    <form onSubmit={handleSubmit} className="space-y-[12px]">
      {isAdminLoggedIn ? (
        <div className="flex items-center gap-[8px] rounded-md border border-primary/30 bg-primary/10 px-[12px] py-[6px] text-[12px] text-primary font-medium">
          <span>已验证博主身份 · {parent ? `回复 ${parent.authorName}` : "发表评论"}</span>
        </div>
      ) : (
        parent && <p className="text-[12px] text-muted-foreground/60">回复 {parent.authorName} · 审核通过后公开</p>
      )}
      <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
        <div>
          <label htmlFor={`comment-name${fieldSuffix}`} className="mb-[4px] block text-[12px] font-medium text-muted-foreground/60">昵称 <span className="text-red-400">*</span></label>
          <input id={`comment-name${fieldSuffix}`} type="text" value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder={isAdminLoggedIn ? "博主" : "你的昵称"} className={inputClass} maxLength={50} required={!isAdminLoggedIn} />
        </div>
        <div>
          <label htmlFor={`comment-email${fieldSuffix}`} className="mb-[4px] block text-[12px] font-medium text-muted-foreground/60">邮箱 <span className="text-muted-foreground/30">{isAdminLoggedIn ? "（博主身份已绑定系统邮箱）" : "（可选，用于回复通知，不公开）"}</span></label>
          <input id={`comment-email${fieldSuffix}`} type="email" value={authorEmail} onChange={(event) => setAuthorEmail(event.target.value)} placeholder={isAdminLoggedIn ? "使用系统管理员邮箱" : "name@example.com"} disabled={isAdminLoggedIn} className={`${inputClass} ${isAdminLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`} maxLength={100} />
        </div>
      </div>
      <input type="text" name="_hp" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
      <div>
        <label htmlFor={`comment-content${fieldSuffix}`} className="mb-[4px] block text-[12px] font-medium text-muted-foreground/60">{parent ? "回复" : "评论"} <span className="text-red-400">*</span></label>
        <textarea id={`comment-content${fieldSuffix}`} value={content} onChange={(event) => setContent(event.target.value)} placeholder={parent ? `回复 ${parent.authorName}...` : "写下你的想法..."} className={`${inputClass} min-h-[100px] resize-y`} maxLength={2000} required />
        <div className="mt-[4px] text-right text-[11px] text-muted-foreground/30">{content.length}/2000</div>
      </div>
      {message && <div className={`rounded-md border px-[12px] py-[8px] text-[13px] ${message.type === "success" ? "border-foreground/12 bg-foreground/[0.06] text-foreground/82" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>{message.text}</div>}
      <div className="flex items-center gap-[8px]">
        <button type="submit" disabled={submitting || (!isAdminLoggedIn && !authorName.trim()) || !content.trim()} className="inline-flex min-h-[44px] items-center gap-[6px] rounded-md bg-foreground px-[16px] py-[8px] text-[13px] font-medium text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[36px]">
          <Send className="h-[14px] w-[14px]" />{submitting ? "提交中..." : parent ? "提交回复" : "发表评论"}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="min-h-[44px] px-[10px] text-[12px] text-muted-foreground/60 hover:text-foreground sm:min-h-[36px]">取消</button>}
      </div>
    </form>
  );
}

function CommentItem({ node, slug, depth, replyingTo, setReplyingTo, isAdminLoggedIn, onSubmitted }: { node: CommentTreeNode<CommentData>; slug: string; depth: number; replyingTo: number | null; setReplyingTo: (id: number | null) => void; isAdminLoggedIn: boolean; onSubmitted: () => void }) {
  const { dateSettings } = useSiteSettings();
  const comment = node.comment;
  const indent = commentIndentStep(depth);
  return (
    <div className={depth === 0 ? "border-t border-border/20 first:border-t-0" : ""} style={{ marginLeft: `${indent}px` }}>
      <article id={`comment-${comment.id}`} className={`group flex gap-[10px] py-[14px] sm:gap-[12px] ${depth > 0 ? "border-l border-border/25 pl-[10px] sm:pl-[14px]" : ""}`}>
        <img src={avatarUrl(comment.authorName)} alt={comment.authorName} className={`h-[32px] w-[32px] shrink-0 rounded-full bg-card/30 ring-1 ${comment.isAdmin ? "ring-primary/60 ring-2" : "ring-border/20"} sm:h-[36px] sm:w-[36px]`} loading="lazy" />
        <div className="min-w-0 flex-1">
          <div className="mb-[4px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px]">
            <span className="text-[14px] font-medium text-foreground">{comment.authorName}</span>
            {comment.isAdmin && (
              <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-[7px] py-[1px] text-[10px] font-semibold text-primary">
                博主
              </span>
            )}
            <span className="text-[12px] text-muted-foreground/50">{formatSiteDate(comment.createdAt, dateSettings)}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.7] text-muted-foreground/80">{comment.content}</p>
          <button type="button" onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="mt-[6px] inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-[4px] text-[12px] text-muted-foreground/55 hover:text-foreground" aria-expanded={replyingTo === comment.id}><Reply className="h-[13px] w-[13px]" />回复</button>
          {replyingTo === comment.id && <div className="mt-[8px] rounded-md border border-border/25 bg-card/10 p-[12px]"><CommentForm slug={slug} parent={comment} isAdminLoggedIn={isAdminLoggedIn} onSubmitted={onSubmitted} onCancel={() => setReplyingTo(null)} /></div>}
        </div>
      </article>
      {node.children.map((child) => <CommentItem key={child.comment.id} node={child} slug={slug} depth={depth + 1} replyingTo={replyingTo} setReplyingTo={setReplyingTo} isAdminLoggedIn={isAdminLoggedIn} onSubmitted={onSubmitted} />)}
    </div>
  );
}

export function CommentsSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    checkAuth().then((authed) => setIsAdminLoggedIn(Boolean(authed))).catch(() => setIsAdminLoggedIn(false));
  }, []);

  const loadComments = useCallback(() => { fetchComments(slug).then(setComments).catch(console.error).finally(() => setLoading(false)); }, [slug]);
  useEffect(() => { loadComments(); }, [loadComments]);
  const forest = buildCommentForest(comments);

  return (
    <section className="mt-[40px] animate-fade-in delay-5">
      <div className="overflow-hidden rounded-md border border-border/32 bg-card/10 transition-all duration-300">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-h-[56px] w-full items-center justify-between bg-transparent p-[16px] text-left transition-colors hover:bg-card/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring md:px-[20px]" title={isOpen ? "收起评论区" : "展开评论区"} aria-expanded={isOpen}>
          <div className="flex items-center gap-[8px]"><MessageCircle className="h-[18px] w-[18px] text-muted-foreground/60" /><h2 className="text-[16px] font-semibold text-foreground">评论区{!loading && comments.length > 0 && <span className="ml-[6px] text-[14px] font-normal text-muted-foreground/50">({comments.length})</span>}</h2></div>
          <div className="flex items-center gap-[6px] text-[13px] text-muted-foreground/50">{isOpen ? <><span className="hidden sm:inline">收起评论</span><ChevronUp className="h-[16px] w-[16px]" /></> : <><span className="hidden sm:inline">{loading ? "加载中..." : comments.length > 0 ? "点击展开" : "留个言吧"}</span><ChevronDown className="h-[16px] w-[16px]" /></>}</div>
        </button>
        {isOpen && <div className="animate-fade-in-down border-t border-border/20 p-[16px] md:px-[20px] md:pb-[24px]">
          {loading ? <div className="py-[20px] text-[13px] text-muted-foreground/40">加载中...</div> : comments.length > 0 ? <div>{forest.map((node) => <CommentItem key={node.comment.id} node={node} slug={slug} depth={0} replyingTo={replyingTo} setReplyingTo={setReplyingTo} isAdminLoggedIn={isAdminLoggedIn} onSubmitted={loadComments} />)}</div> : <div className="flex flex-col items-center justify-center py-[24px] text-center"><User className="mb-[8px] h-[32px] w-[32px] text-muted-foreground/20" /><p className="text-[14px] text-muted-foreground/40">还没有评论，来做第一个留言的人吧</p></div>}
          <Separator className="my-[24px] bg-border/20" />
          <h3 className="mb-[12px] text-[14px] font-medium text-muted-foreground/60">发表评论</h3>
          <CommentForm slug={slug} isAdminLoggedIn={isAdminLoggedIn} onSubmitted={loadComments} />
        </div>}
      </div>
    </section>
  );
}
