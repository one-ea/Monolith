import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchPost, type Post } from "@/lib/api";
import { renderMarkdown, extractHeadings } from "@/lib/markdown";
import { ArrowLeft, Eye, BookOpen, X } from "lucide-react";
import { ReadingControls, useReadingPreferences } from "@/components/reading-controls";
import { TableOfContents, ReadingProgressBar } from "@/components/toc";
import { SeoHead } from "@/components/seo-head";
import { CommentsSection } from "@/components/comments";
import { RelatedPosts } from "@/components/related-posts";
import { SeriesNav } from "@/components/series-nav";
import { PostReactions } from "@/components/post-reactions";
import { ShareButtons } from "@/components/share-buttons";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

const renderedPostCache = new Map<string, {
  htmlContent: string;
  headings: { id: string; text: string; level: number }[];
}>();

function getRenderedPostCacheKey(post: Pick<Post, "slug" | "updatedAt">) {
  return `${post.slug}:${post.updatedAt}`;
}

export function PostPage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readingMode, setReadingMode] = useState(false);
  const { preferences, updatePreference } = useReadingPreferences();

  // 阅读模式切换
  const toggleReadingMode = useCallback(() => {
    setReadingMode((prev) => !prev);
  }, []);

  // ESC 退出阅读模式
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && readingMode) setReadingMode(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [readingMode]);

  // 处理阅读模式样式与属性
  useEffect(() => {
    document.documentElement.classList.toggle("reading-mode", readingMode);
    
    if (readingMode && preferences.theme !== "system") {
      document.documentElement.setAttribute("data-reading-theme", preferences.theme);
    } else {
      document.documentElement.removeAttribute("data-reading-theme");
    }

    return () => {
      document.documentElement.classList.remove("reading-mode");
      document.documentElement.removeAttribute("data-reading-theme");
    };
  }, [readingMode, preferences.theme]);

  useEffect(() => {
    if (!params.slug) return;
    
    // 路由跳转时如果不带锚点，强制回到顶部
    if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    
    setLoading(true);
    fetchPost(params.slug)
      .then(setPost)
      .catch(() => setError("文章未找到"))
      .finally(() => setLoading(false));
  }, [params.slug]);

  // 提取标题列表（用于 TOC）和 Markdown 渲染
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
  const [htmlContent, setHtmlContent] = useState("");

  useEffect(() => {
    if (!post) {
      setHeadings([]);
      setHtmlContent("");
      return;
    }

    const cacheKey = getRenderedPostCacheKey(post);
    const cached = renderedPostCache.get(cacheKey);
    if (cached) {
      setHeadings(cached.headings);
      setHtmlContent(cached.htmlContent);
      return;
    }

    const nextHeadings = extractHeadings(post.content);
    const nextHtmlContent = renderMarkdown(post.content);
    renderedPostCache.set(cacheKey, {
      headings: nextHeadings,
      htmlContent: nextHtmlContent,
    });
    setHeadings(nextHeadings);
    setHtmlContent(nextHtmlContent);
  }, [post]);

  // 图片渐进淡入（Intersection Observer）
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!contentRef.current) return;
    const imgs = contentRef.current.querySelectorAll<HTMLImageElement>("img[data-lazy-img]");
    if (imgs.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            img.classList.add("lazy-img--loaded");
            observer.unobserve(img);
          }
        });
      },
      { rootMargin: "100px", threshold: 0.01 }
    );

    imgs.forEach((img) => {
      if (img.complete) {
        img.classList.add("lazy-img--loaded");
      } else {
        img.addEventListener("load", () => img.classList.add("lazy-img--loaded"), { once: true });
        observer.observe(img);
      }
    });

    return () => observer.disconnect();
  }, [htmlContent]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[720px] py-[40px] sm:py-[56px] px-[16px] lg:px-0">
        <div className="animate-pulse space-y-[16px]">
          <div className="h-[20px] w-[100px] rounded bg-card/30" />
          <div className="h-[40px] w-3/4 rounded bg-card/30" />
          <div className="h-[16px] w-full rounded bg-card/30" />
          <div className="h-[16px] w-5/6 rounded bg-card/30" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <h1 className="text-[20px] text-muted-foreground">{error || "文章未找到"}</h1>
      </div>
    );
  }

  return (
    <>
      {/* SEO 元数据 */}
      <SeoHead
        title={post.title}
        description={post.excerpt || undefined}
        url={`/posts/${post.slug}`}
        type="article"
        publishedTime={post.createdAt}
        modifiedTime={post.updatedAt}
        tags={post.tags}
        breadcrumbs={[
          { name: "首页", url: "/" },
          { name: post.title, url: `/posts/${post.slug}` },
        ]}
      />

      {/* 阅读进度条 */}
      <ReadingProgressBar />

      {/* 三栏布局容器：文章 + TOC 侧边栏 */}
      <div 
        className="post-layout mx-auto w-full max-w-[1100px] px-[16px] lg:px-[24px]"
        style={readingMode ? {
          "--rm-width": `${preferences.maxWidth}px`,
          "--rm-font": preferences.fontFamily === "serif" ? "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif" : "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          "--rm-size": `${preferences.fontSize}px`,
          "--rm-line-height": preferences.lineHeight,
        } as React.CSSProperties : undefined}
      >
        {/* 主内容区 */}
        <article className="post-content py-[28px] lg:py-[48px]">
          <div className="mb-[32px] flex items-center justify-between gap-[12px] animate-fade-in">
            <Link href="/" className="inline-flex min-h-[44px] items-center gap-[6px] rounded-md text-[13px] text-muted-foreground/60 transition-all duration-200 hover:-translate-x-[2px] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <ArrowLeft className="h-[14px] w-[14px]" />返回首页
            </Link>
            <button
              onClick={toggleReadingMode}
              className="reading-mode-toggle inline-flex min-h-[44px] items-center gap-[6px] rounded-md px-[8px] text-[12px] text-muted-foreground/50 transition-all duration-200 hover:bg-accent/30 hover:text-foreground/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              title="进入专注阅读模式"
              aria-label="进入专注阅读模式"
            >
              <BookOpen className="h-[14px] w-[14px]" />
              专注阅读
            </button>
          </div>

          <header className="mb-[32px] animate-fade-in-up delay-1 rounded-md border border-border/20 bg-background/30 p-[18px] sm:p-[24px]">
            <div className="mb-[18px] flex items-center gap-[12px]">
              <div className={`h-[2px] w-[64px] rounded-full bg-gradient-to-r ${post.coverColor || "from-gray-500/20 to-gray-600/20"} grayscale`} />
              <span className="font-mono text-[11px] uppercase text-muted-foreground/40">Reading File</span>
            </div>
            <div className="mb-[16px] flex flex-wrap items-center gap-[8px]">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="h-[22px] rounded-[4px] px-[8px] text-[12px] font-normal">{tag}</Badge>
              ))}
              <span className="text-[12px] text-muted-foreground/50">{formatDate(post.createdAt)}</span>
              <span className="text-[12px] text-muted-foreground/50 inline-flex items-center gap-[4px]"><Eye className="h-[12px] w-[12px]" />{(post.viewCount ?? 0).toLocaleString()}</span>
            </div>
            <h1 className="font-heading text-[30px] font-semibold tracking-[-0.035em] leading-[1.08] sm:text-[40px] lg:text-[48px]">{post.title}</h1>
            <p className="mt-[18px] max-w-[680px] text-[16px] leading-[1.85] text-muted-foreground">{post.excerpt}</p>
          </header>

          {/* 移动端 TOC（显示在分隔线上方） */}
          {headings.length >= 2 && (
            <div className="mb-[24px] xl:hidden">
              <TableOfContents headings={headings} />
            </div>
          )}

          <Separator className="mb-[32px] bg-border/30" />

          {/* 文章正文，同时处理代码块复制逻辑 */}
          <div 
            ref={contentRef}
            className="prose-monolith animate-fade-in delay-3" 
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
            onClick={(e) => {
          const target = e.target as HTMLElement;
              const btn = target.closest('.copy-code-btn');
              if (btn) {
                const wrapper = btn.closest('.code-block-wrapper');
                const codeNode = wrapper?.querySelector('code');
                if (codeNode && codeNode.textContent) {
                  // 固定 SVG 常量（避免从 DOM 属性读取后设 innerHTML 的 XSS 风险）
                  const COPY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
                  const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400"><path d="M20 6 9 17l-5-5"/></svg>';
                  navigator.clipboard.writeText(codeNode.textContent).then(() => {
                    btn.innerHTML = CHECK_SVG;
                    setTimeout(() => {
                      btn.innerHTML = COPY_SVG;
                    }, 2000);
                  }).catch(console.error);
                }
              }
            }}
          />

          <Separator className="mt-[48px] bg-border/30" />
          <div className="mt-[24px] flex items-center justify-between flex-wrap gap-[16px] animate-fade-in delay-4">
            <div className="flex items-center gap-[16px]">
              <Link href="/" className="inline-flex min-h-[44px] items-center gap-[6px] rounded-md text-[13px] text-muted-foreground/60 transition-all duration-200 hover:-translate-x-[2px] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <ArrowLeft className="h-[14px] w-[14px]" />返回首页
              </Link>
              <span className="text-[12px] text-muted-foreground/40 hidden sm:inline-block">发布于 {formatDate(post.createdAt)}</span>
            </div>
            
            {/* 分享按钮组件 */}
            <ShareButtons title={post.title} />
          </div>

          {/* 表情反应 */}
          <PostReactions slug={post.slug} />

          {/* 系列导航 */}
          {post.seriesSlug && (
            <SeriesNav seriesSlug={post.seriesSlug} currentSlug={post.slug} />
          )}

          {/* 相关推荐 */}
          <RelatedPosts currentSlug={post.slug} currentTags={post.tags} />

          {/* 评论区 */}
          <CommentsSection slug={post.slug} />
        </article>

        {/* 桌面端 TOC 侧边栏 */}
        {headings.length >= 2 && (
          <TableOfContents headings={headings} />
        )}
      </div>
      {/* 阅读模式控制面板 */}
      <ReadingControls
        isActive={readingMode}
        onClose={() => setReadingMode(false)}
        preferences={preferences}
        updatePreference={updatePreference}
      />
    </>
  );
}
