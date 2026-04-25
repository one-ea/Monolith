import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { PostMeta } from "@/lib/api";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

/** 取标题首字作为无图占位 */
function getInitial(title: string): string {
  if (!title) return "·";
  const ch = title.trim().charAt(0);
  return ch || "·";
}

export function ArticleCard({ post }: { post: PostMeta }) {
  const cover = post.coverImage || "";
  const gradient = post.coverColor || "from-gray-500/20 to-gray-600/20";

  return (
    <Link href={`/posts/${post.slug}`} className="group block">
      <article className="relative overflow-hidden rounded-md border border-border/40 bg-card/30 backdrop-blur-sm transition-all duration-300 hover:border-border/70 hover:bg-card/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-[2px]">
        <div className="flex flex-col sm:flex-row">
          {/* 封面区 */}
          <div className="relative shrink-0 overflow-hidden sm:w-[180px] lg:w-[200px]">
            <div className="aspect-[16/10] sm:h-full sm:aspect-auto sm:min-h-[140px]">
              {cover ? (
                <img
                  src={cover}
                  alt={post.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                />
              ) : (
                <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient}`}>
                  <span className="select-none text-[44px] font-semibold tracking-[-0.04em] text-foreground/30 lg:text-[52px]">
                    {getInitial(post.title)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex min-w-0 flex-1 flex-col p-[16px] sm:p-[20px] lg:p-[24px]">
            <div className="mb-[8px] flex flex-wrap items-center gap-[8px]">
              {post.pinned && (
                <Badge variant="outline" className="h-[22px] rounded-[4px] px-[8px] text-[12px] font-normal tracking-normal border-amber-500/30 text-amber-500/80 bg-amber-500/10">📌</Badge>
              )}
              {post.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="h-[22px] rounded-[4px] px-[8px] text-[12px] font-normal tracking-normal">{tag}</Badge>
              ))}
              <span className="text-[12px] text-muted-foreground/60">{formatDate(post.createdAt)}</span>
            </div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] leading-snug text-foreground transition-colors duration-200 group-hover:text-foreground/90 lg:text-[20px]">
              {post.title}
            </h2>
            <p className="mt-[8px] text-[14px] leading-[1.7] text-muted-foreground line-clamp-2">
              {post.excerpt}
            </p>
            <div className="mt-auto pt-[12px] flex items-center gap-[6px] text-[13px] text-muted-foreground/50 transition-colors duration-200 group-hover:text-muted-foreground">
              <span>阅读全文</span>
              <svg className="h-[14px] w-[14px] transition-transform duration-200 group-hover:translate-x-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
