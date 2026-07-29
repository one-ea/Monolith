import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { BookOpen, ChevronLeft, ChevronRight, List, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SeoHead } from "@/components/seo-head";
import { TableOfContents, ReadingProgressBar } from "@/components/toc";
import { fetchPost, fetchSeriesPosts, type Post, type SeriesPost } from "@/lib/api";
import { extractHeadings, renderMarkdown, type TocHeading } from "@/lib/markdown";
import { formatSiteDate } from "@/lib/date-format";
import { useSiteSettings } from "@/lib/site-settings";

function SeriesDirectory({ seriesSlug, currentSlug, posts, mobile = false }: {
  seriesSlug: string;
  currentSlug: string;
  posts: SeriesPost[];
  mobile?: boolean;
}) {
  return (
    <nav aria-label={`${seriesSlug} 文档目录`} className={mobile ? "space-y-[4px]" : "sticky top-[88px] space-y-[10px]"}>
      <div className="flex items-center gap-[8px] text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/45">
        <List className="h-[13px] w-[13px]" />
        <span>文档目录</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/35">{posts.length}</span>
      </div>
      <ol className="space-y-[2px] border-l border-border/20 pl-[10px]">
        {posts.map((item, index) => {
          const active = item.slug === currentSlug;
          return (
            <li key={item.slug}>
              {active ? (
                <span className="flex min-h-[40px] items-start gap-[8px] rounded-md bg-card/45 px-[10px] py-[8px] text-[13px] font-medium text-foreground" aria-current="page">
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/45">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 leading-[1.45]">{item.title}</span>
                </span>
              ) : (
                <Link href={`/docs/${seriesSlug}/${item.slug}`} className="flex min-h-[40px] items-start gap-[8px] rounded-md px-[10px] py-[8px] text-[13px] text-muted-foreground/70 transition-colors hover:bg-accent/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/35">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 leading-[1.45]">{item.title}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DocsPage() {
  const params = useParams<{ seriesSlug: string; slug?: string }>();
  const { dateSettings, settings } = useSiteSettings();
  const [seriesPosts, setSeriesPosts] = useState<SeriesPost[]>([]);
  const [post, setPost] = useState<Post | null>(null);
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.seriesSlug) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setPost(null);

    fetchSeriesPosts(params.seriesSlug)
      .then(async (items) => {
        if (cancelled) return;
        setSeriesPosts(items);
        const currentSlug = params.slug && items.some((item) => item.slug === params.slug)
          ? params.slug
          : items[0]?.slug;
        if (!currentSlug) throw new Error("文档系列不存在");
        const currentPost = await fetchPost(currentSlug);
        if (!cancelled) setPost(currentPost);
      })
      .catch(() => {
        if (!cancelled) setError("文档系列加载失败，请检查链接或稍后重试。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.seriesSlug, params.slug]);

  useEffect(() => {
    if (!post) {
      setHeadings([]);
      setHtmlContent("");
      return;
    }
    setHeadings(extractHeadings(post.content));
    setHtmlContent(renderMarkdown(post.content));
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [post]);

  const currentIndex = useMemo(
    () => seriesPosts.findIndex((item) => item.slug === post?.slug),
    [post?.slug, seriesPosts],
  );
  const previous = currentIndex > 0 ? seriesPosts[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < seriesPosts.length - 1 ? seriesPosts[currentIndex + 1] : null;
  const seriesTitle = params.seriesSlug || "文档系列";

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-[16px] py-[40px] sm:px-[20px] sm:py-[56px]">
        <div className="animate-pulse space-y-[16px]">
          <div className="h-[18px] w-[180px] rounded-md bg-card/30" />
          <div className="h-[42px] w-3/4 rounded-md bg-card/30" />
          <div className="h-[18px] w-full rounded-md bg-card/30" />
          <div className="h-[18px] w-5/6 rounded-md bg-card/30" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-1 items-center justify-center px-[20px] py-[80px] text-center">
        <div>
          <p className="text-[18px] font-medium text-foreground/80">{error || "文档未找到"}</p>
          <Link href="/" className="mt-[14px] inline-flex min-h-[44px] items-center rounded-md border border-border/25 px-[14px] text-[13px] text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title={`${seriesTitle} · ${post.title}`}
        siteName={settings.site_title}
        description={post.excerpt || `${seriesTitle} 文档系列`}
        url={`/docs/${params.seriesSlug}/${post.slug}`}
        type="article"
        publishedTime={post.createdAt}
        modifiedTime={post.updatedAt}
        tags={post.tags}
        breadcrumbs={[
          { name: "首页", url: "/" },
          { name: "文档", url: `/docs/${params.seriesSlug}` },
          { name: post.title, url: `/docs/${params.seriesSlug}/${post.slug}` },
        ]}
      />
      <ReadingProgressBar />

      <div className="mx-auto w-full max-w-[1180px] px-[16px] sm:px-[20px] lg:px-[32px]">
        <div className="flex items-center gap-[8px] py-[18px] text-[12px] text-muted-foreground/50">
          <Link href="/" className="transition-colors hover:text-foreground">首页</Link>
          <ChevronRight className="h-[12px] w-[12px]" />
          <span className="text-muted-foreground/70">文档</span>
          <ChevronRight className="h-[12px] w-[12px]" />
          <span className="truncate text-foreground/75">{seriesTitle}</span>
        </div>

        <div className="mb-[20px] xl:hidden">
          <Sheet>
            <SheetTrigger className="inline-flex min-h-[44px] items-center gap-[8px] rounded-md border border-border/25 bg-card/30 px-[12px] text-[13px] text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Menu className="h-[15px] w-[15px]" />
              打开文档目录
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(88vw,340px)] bg-background/95 p-[20px] backdrop-blur-xl">
              <div className="mb-[20px] flex items-center gap-[8px] text-[15px] font-medium text-foreground"><BookOpen className="h-[16px] w-[16px]" />{seriesTitle}</div>
              <SeriesDirectory seriesSlug={params.seriesSlug} currentSlug={post.slug} posts={seriesPosts} mobile />
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid gap-[28px] pb-[64px] xl:grid-cols-[240px_minmax(0,720px)] xl:gap-[44px]">
          <aside className="hidden xl:block">
            <SeriesDirectory seriesSlug={params.seriesSlug} currentSlug={post.slug} posts={seriesPosts} />
          </aside>

          <article className="min-w-0">
            <header className="mb-[28px] rounded-md border border-border/20 bg-background/25 p-[18px] sm:p-[24px]">
              <div className="mb-[16px] flex flex-wrap items-center gap-[8px]">
                <span className="inline-flex items-center gap-[6px] font-mono text-[11px] text-muted-foreground/45"><BookOpen className="h-[12px] w-[12px]" />DOCS / {seriesTitle.toUpperCase()}</span>
                {post.category && <Badge variant="outline" className="h-[22px] rounded-[4px] px-[7px] text-[11px]">{post.category}</Badge>}
              </div>
              <h1 className="font-heading text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-[42px]">{post.title}</h1>
              <p className="mt-[14px] max-w-[680px] text-[15px] leading-[1.8] text-muted-foreground">{post.excerpt}</p>
              <div className="mt-[18px] flex flex-wrap items-center gap-[10px] border-t border-border/16 pt-[12px] text-[12px] text-muted-foreground/50">
                <span>{formatSiteDate(post.createdAt, dateSettings)}</span>
                <span aria-hidden="true">·</span>
                <span>{currentIndex + 1} / {seriesPosts.length}</span>
              </div>
            </header>

            {headings.length >= 2 && <div className="mb-[24px] xl:hidden"><TableOfContents headings={headings} /></div>}

            <div className="prose-monolith" dangerouslySetInnerHTML={{ __html: htmlContent }} />

            <div className="mt-[44px] grid gap-[10px] border-t border-border/20 pt-[20px] sm:grid-cols-2">
              {previous ? (
                <Link href={`/docs/${params.seriesSlug}/${previous.slug}`} className="group flex min-h-[72px] items-center gap-[10px] rounded-md border border-border/18 bg-card/15 p-[12px] transition-colors hover:bg-card/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <ChevronLeft className="h-[16px] w-[16px] shrink-0 text-muted-foreground/55 transition-transform group-hover:-translate-x-[2px]" />
                  <span className="min-w-0"><span className="block text-[11px] text-muted-foreground/45">上一篇</span><span className="mt-[4px] block truncate text-[13px] text-foreground/80">{previous.title}</span></span>
                </Link>
              ) : <div />}
              {next && (
                <Link href={`/docs/${params.seriesSlug}/${next.slug}`} className="group flex min-h-[72px] items-center justify-end gap-[10px] rounded-md border border-border/18 bg-card/15 p-[12px] text-right transition-colors hover:bg-card/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <span className="min-w-0"><span className="block text-[11px] text-muted-foreground/45">下一篇</span><span className="mt-[4px] block truncate text-[13px] text-foreground/80">{next.title}</span></span><ChevronRight className="h-[16px] w-[16px] shrink-0 text-muted-foreground/55 transition-transform group-hover:translate-x-[2px]" />
                </Link>
              )}
            </div>
          </article>

          <div className="hidden xl:block xl:col-start-2">
            {headings.length >= 2 && <TableOfContents headings={headings} />}
          </div>
        </div>
      </div>
    </>
  );
}

