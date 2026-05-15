import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { fetchPosts, type PostMeta } from "@/lib/api";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type RelatedPostsProps = {
  currentSlug: string;
  currentTags: string[];
};

/**
 * 相关文章推荐组件
 * 基于标签交集相似度推荐，展示最多 3 篇相关文章
 */
export function RelatedPosts({ currentSlug, currentTags }: RelatedPostsProps) {
  const [allPosts, setAllPosts] = useState<PostMeta[]>([]);

  useEffect(() => {
    fetchPosts().then(setAllPosts).catch(() => {});
  }, []);

  const related = useMemo(() => {
    if (allPosts.length === 0 || currentTags.length === 0) return [];

    const currentTagSet = new Set(currentTags);

    return allPosts
      .filter((p) => p.slug !== currentSlug)
      .map((p) => {
        // 计算标签交集数量作为相似度得分
        const overlap = p.tags.filter((t) => currentTagSet.has(t)).length;
        return { post: p, score: overlap };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime())
      .slice(0, 3)
      .map((item) => item.post);
  }, [allPosts, currentSlug, currentTags]);

  if (related.length === 0) return null;

  return (
    <section className="mt-[48px] animate-fade-in">
      <h2 className="mb-[20px] flex items-center gap-[8px] text-[14px] font-medium uppercase tracking-normal text-muted-foreground/50">
        <span className="h-[1px] flex-1 bg-border/20" />
        相关推荐
        <span className="h-[1px] flex-1 bg-border/20" />
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px]">
        {related.map((post) => (
          <Link
            key={post.slug}
            href={`/posts/${post.slug}`}
            className="group relative flex flex-col rounded-xl border border-border/15 bg-card/5 p-[16px] hover:border-border/35 hover:bg-card/20 transition-all duration-300"
          >
            {/* 顶部渐变装饰条 */}
            <div className={`mb-[12px] h-[2px] w-[32px] rounded-full bg-gradient-to-r ${post.coverColor || "from-gray-500/30 to-gray-600/30"} grayscale transition-all duration-300 group-hover:w-[48px]`} />

            {/* 标签 */}
            <div className="mb-[8px] flex flex-wrap gap-[4px]">
              {post.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="h-[18px] rounded-[3px] px-[6px] text-[10px] font-normal opacity-60">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* 标题 */}
            <h3 className="text-[14px] font-medium leading-[1.5] text-foreground/80 group-hover:text-foreground transition-colors line-clamp-2 flex-1">
              {post.title}
            </h3>

            {/* 底部箭头 */}
            <div className="mt-[12px] flex items-center text-[11px] text-muted-foreground/30 transition-colors group-hover:text-foreground/70">
              阅读全文
              <ArrowRight className="ml-[4px] h-[10px] w-[10px] translate-x-0 group-hover:translate-x-[3px] transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
