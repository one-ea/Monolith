import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchPosts, type PostMeta } from "@/lib/api";
import { AnimateIn } from "@/hooks/use-animate";
import { SeoHead } from "@/components/seo-head";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export function ArchivePage() {
  const searchString = useSearch();
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPosts = () => {
    setLoading(true);
    setError("");
    fetchPosts()
      .then((data) => {
        setPosts(data);
        setError("");
      })
      .catch((err: unknown) => {
        console.error(err);
        setError("归档加载失败，请检查网络后重试。");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const selectedCategory = new URLSearchParams(searchString).get("category") || "";
  const visiblePosts = selectedCategory ? posts.filter((post) => post.category === selectedCategory) : posts;

  const grouped = new Map<string, PostMeta[]>();
  for (const post of visiblePosts) {
    const year = new Date(post.createdAt).getFullYear().toString();
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(post);
  }
  const years = Array.from(grouped.keys()).sort((a, b) => Number(b) - Number(a));
  const archiveTitle = selectedCategory ? `分类：${selectedCategory}` : "归档";
  const archiveDescription = selectedCategory
    ? `共 ${visiblePosts.length} 篇 ${selectedCategory} 分类文章，按时间倒序排列。`
    : `共 ${posts.length} 篇文章，按时间倒序排列。`;
  const archiveUrl = selectedCategory ? `/archive?category=${encodeURIComponent(selectedCategory)}` : "/archive";
  const breadcrumbs = [
    { name: "首页", url: "/" },
    { name: "归档", url: "/archive" },
    ...(selectedCategory ? [{ name: `分类：${selectedCategory}`, url: archiveUrl }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[760px] px-[16px] py-[32px] lg:px-0 lg:py-[56px]">
      <SeoHead title={archiveTitle} description={archiveDescription} url={archiveUrl} breadcrumbs={breadcrumbs} />
      <div className="animate-fade-in-up">
        <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em]">{archiveTitle}</h1>
        <div className="mt-[8px] flex flex-col gap-[8px] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-muted-foreground">{archiveDescription}</p>
          {selectedCategory && (
            <Link href="/archive" className="inline-flex min-h-[36px] items-center rounded-md border border-border/20 px-[10px] text-[12px] text-muted-foreground/70 transition-colors hover:bg-accent/35 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              查看全部
            </Link>
          )}
        </div>
      </div>
      <Separator className="my-[24px] bg-border/25" />

      {loading ? (
        <div className="space-y-[12px]">{[1, 2, 3, 4].map((i) => <div key={i} className="h-[44px] animate-pulse rounded bg-card/20" />)}</div>
      ) : error ? (
        <div className="rounded-md border border-dashed border-red-400/25 bg-red-400/8 px-[20px] py-[52px] text-center">
          <p className="text-[15px] font-medium text-red-400/90">{error}</p>
          <button
            type="button"
            onClick={loadPosts}
            className="mt-[14px] inline-flex min-h-[40px] items-center rounded-md border border-border/20 px-[12px] text-[12px] text-muted-foreground/75 transition-colors hover:bg-accent/35 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            重试
          </button>
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/25 bg-background/20 px-[20px] py-[52px] text-center">
          <p className="text-[15px] font-medium text-foreground/80">
            {selectedCategory ? "没有找到匹配文章" : "暂无文章"}
          </p>
          <p className="mx-auto mt-[8px] max-w-[360px] text-[13px] leading-[1.7] text-muted-foreground/60">
            {selectedCategory
              ? "当前分类下暂无可见文章，可以返回全部归档继续浏览。"
              : "博客暂无已发布文章，请稍后再来。"}
          </p>
        </div>
      ) : (
        years.map((year, yi) => (
          <AnimateIn key={year} delay={`delay-${Math.min(yi, 4)}`} className="mb-[32px]">
            <h2 className="mb-[16px] text-[20px] font-semibold tracking-[-0.01em] text-muted-foreground/40">{year}</h2>
            <div className="flex flex-col gap-[2px]">
              {grouped.get(year)!.map((post) => (
                <Link key={post.slug} href={`/posts/${post.slug}`} className="-mx-[12px] group flex min-h-[44px] items-baseline gap-[12px] rounded-md px-[12px] py-[10px] transition-all duration-200 hover:translate-x-[4px] hover:bg-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground/40 w-[90px]">{formatDate(post.createdAt).replace(/\d{4}年/, "")}</span>
                  <span className="text-[15px] text-foreground transition-colors duration-200 group-hover:text-foreground/80">{post.title}</span>
                  <div className="ml-auto hidden shrink-0 gap-[4px] sm:flex">
                    {post.tags.slice(0, 1).map((tag) => (
                      <Badge key={tag} variant="outline" className="h-[20px] rounded-[3px] px-[6px] text-[11px] font-normal text-muted-foreground/50">{tag}</Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </AnimateIn>
        ))
      )}
    </div>
  );
}
