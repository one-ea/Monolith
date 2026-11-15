type CommentReplyEmailInput = {
  recipientName: string;
  replyAuthorName: string;
  replyContent: string;
  postTitle: string;
  postSlug: string;
  parentCommentId: number;
  siteOrigin: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildCommentReplyEmail(input: CommentReplyEmailInput): { subject: string; html: string } {
  const origin = input.siteOrigin.replace(/\/$/, "");
  const commentUrl = `${origin}/posts/${encodeURIComponent(input.postSlug)}#comment-${input.parentCommentId}`;
  return {
    subject: `[Monolith] 你在《${input.postTitle}》的评论收到了回复`,
    html: `<p>你好，${escapeHtml(input.recipientName)}：</p>
      <p><strong>${escapeHtml(input.replyAuthorName)}</strong> 回复了你在《${escapeHtml(input.postTitle)}》的评论：</p>
      <blockquote style="border-left: 4px solid #eee; padding-left: 10px; color: #555;">${escapeHtml(input.replyContent)}</blockquote>
      <p><a href="${escapeHtml(commentUrl)}">查看回复</a></p>`,
  };
}

export function shouldNotifyCommentReply(parent: { approved: boolean; authorEmail: string }): boolean {
  return parent.approved && parent.authorEmail.trim().length > 0;
}
