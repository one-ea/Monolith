import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { PostMeta } from "@/lib/api";
import { clampCardHeight, clampCardWidth, getArticleCardGridClass, getArticleCardImageMode } from "@/lib/card-layout";
import { ArrowRight, CalendarDays, FolderOpen, Pin } from "lucide-react";
import type { CSSProperties } from "react";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export function ArticleCard({ post }: { post: PostMeta }) {
  const width = clampCardWidth(post.cardWidth);
  const height = clampCardHeight(post.cardHeight);
  const cover = post.coverImage?.trim() || "";
  const imageMode = getArticleCardImageMode(width, height, Boolean(cover));
  const isBackground = imageMode === "background";
  const compact = height < 190;
  const style = {
    "--article-card-height": `${height}px`,
  } as CSSProperties;
  const gridClass = getArticleCardGridClass(width);
  const titleClass = "line-clamp-2 font-heading text-[20px] font-semibold leading-snug tracking-[-0.018em] text-foreground transition-colors duration-200 group-hover:text-foreground/90 lg:text-[23px]";
  const excerptClass = compact
    ? "mt-[8px] line-clamp-1 text-[13px] leading-[1.65] text-muted-foreground"
    : "mt-[10px] line-clamp-2 text-[14px] leading-[1.75] text-muted-foreground";

  const meta = (
    <div className="mb-[10px] flex flex-wrap items-center gap-[8px]">
      {post.pinned && (
        <Badge variant="outline" className="h-[24px] rounded-[4px] border-amber-500/30 bg-amber-500/10 px-[8px] text-[12px] font-normal tracking-normal text-amber-500/90">
          <Pin className="h-[12px] w-[12px]" />
          置顶
        </Badge>
      )}
      {post.tags.slice(0, 2).map((tag) => (
        <Badge key={tag} variant="secondary" className="h-[24px] rounded-[4px] px-[8px] text-[12px] font-normal tracking-normal">{tag}</Badge>
      ))}
      <span className="inline-flex items-center gap-[4px] text-[12px] text-muted-foreground/55">
        <CalendarDays className="h-[12px] w-[12px]" />
        {formatDate(post.createdAt)}
      </span>
    </div>
  );

  const body = (
    <>
      {meta}
      <h2 className={titleClass}>{post.title}</h2>
      <p className={excerptClass}>{post.excerpt}</p>
      <div className={`mt-auto flex min-h-[36px] items-end justify-between gap-[12px] ${compact ? "pt-[8px]" : "pt-[14px]"}`}>
        <span className="inline-flex min-w-0 items-center gap-[4px] text-[12px] text-muted-foreground/35">
          <FolderOpen className="h-[12px] w-[12px] shrink-0" />
          <span className="truncate">{post.category || "未分类"}</span>
        </span>
        <span className="inline-flex items-center gap-[6px] text-[13px] text-muted-foreground/55 transition-colors duration-200 group-hover:text-foreground">
          阅读全文
          <ArrowRight className="h-[14px] w-[14px] transition-transform duration-200 group-hover:translate-x-[3px]" />
        </span>
      </div>
    </>
  );

  return (
    <Link
      href={`/posts/${post.slug}`}
      className={`group block w-full rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${gridClass}`}
      style={style}
    >
      <article
        className={`relative flex h-[var(--article-card-height)] overflow-hidden rounded-md border border-border/20 bg-background/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-border/55 hover:bg-card/28 ${isBackground ? "bg-card/18" : ""}`}
      >
        {imageMode === "background" && (
          <>
            <img src={cover} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-br from-background/92 via-background/74 to-background/44" />
            <div className="relative flex min-h-0 w-full flex-col p-[16px] sm:p-[18px] lg:p-[20px]">{body}</div>
          </>
        )}
        {imageMode === "side" && (
          <div className="grid min-h-0 w-full md:grid-cols-[minmax(0,1fr)_34%]">
            <div className="flex min-w-0 flex-col p-[16px] sm:p-[18px] lg:p-[20px]">{body}</div>
            <div className="hidden border-l border-border/16 md:block">
              <img src={cover} alt={post.title} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]" />
            </div>
          </div>
        )}
        {imageMode === "top" && (
          <div className="flex min-h-0 w-full flex-col">
            <div className="h-[132px] overflow-hidden border-b border-border/16">
              <img src={cover} alt={post.title} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col p-[16px] sm:p-[18px] lg:p-[20px]">{body}</div>
          </div>
        )}
        {imageMode === "thumbnail" && (
          <div className="flex min-h-0 w-full gap-[14px] p-[16px] sm:p-[18px] lg:p-[20px]">
            <div className="flex min-w-0 flex-1 flex-col">{body}</div>
            <div className="hidden h-[76px] w-[116px] shrink-0 overflow-hidden rounded-md border border-border/16 sm:block">
              <img src={cover} alt={post.title} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]" />
            </div>
          </div>
        )}
        {imageMode === "text" && (
          <div className="flex min-h-0 w-full flex-col p-[16px] sm:p-[18px] lg:p-[20px]">{body}</div>
        )}
      </article>
    </Link>
  );
}
