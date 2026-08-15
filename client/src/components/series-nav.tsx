import { useState, useEffect } from "react";
import { Link } from "wouter";
import { fetchSeriesPosts, type SeriesPost } from "@/lib/api";
import { ChevronLeft, ChevronRight, List } from "lucide-react";

interface SeriesNavProps {
  seriesSlug: string;
  currentSlug: string;
}

export function SeriesNav({ seriesSlug, currentSlug }: SeriesNavProps) {
  const [posts, setPosts] = useState<SeriesPost[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchSeriesPosts(seriesSlug).then(setPosts);
  }, [seriesSlug]);

  if (posts.length < 2) return null;

  const currentIndex = posts.findIndex((p) => p.slug === currentSlug);
  const prev = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const next = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;

  return (
    <div className="series-nav">
      {/* 系列标题 + 目录切换 */}
      <div className="series-nav__header">
        <button
          onClick={() => setExpanded(!expanded)}
          className="series-nav__toggle"
        >
          <List className="series-nav__icon" />
          <span className="series-nav__title">
            系列：{seriesSlug}
          </span>
          <span className="series-nav__count">
            {currentIndex + 1} / {posts.length}
          </span>
        </button>
        <Link href={`/docs/${seriesSlug}/${currentSlug}`} className="series-nav__docs-link" aria-label={`以文档模式打开系列 ${seriesSlug}`}>
          文档模式
        </Link>
      </div>

      {/* 可折叠目录 */}
      {expanded && (
        <ol className="series-nav__list">
          {posts.map((post, i) => (
            <li
              key={post.slug}
              className={`series-nav__item ${post.slug === currentSlug ? "series-nav__item--active" : ""}`}
            >
              {post.slug === currentSlug ? (
                <span className="series-nav__current">
                  <span className="series-nav__num">{i + 1}.</span>
                  {post.title}
                </span>
              ) : (
                <Link
                  href={`/posts/${post.slug}`}
                  className="series-nav__link"
                >
                  <span className="series-nav__num">{i + 1}.</span>
                  {post.title}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* 上/下一篇导航 */}
      <div className="series-nav__arrows">
        {prev ? (
          <Link href={`/posts/${prev.slug}`} className="series-nav__arrow series-nav__arrow--prev">
            <ChevronLeft className="series-nav__arrow-icon" />
            <div className="series-nav__arrow-text">
              <span className="series-nav__arrow-label">上一篇</span>
              <span className="series-nav__arrow-title">{prev.title}</span>
            </div>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link href={`/posts/${next.slug}`} className="series-nav__arrow series-nav__arrow--next">
            <div className="series-nav__arrow-text" style={{ textAlign: "right" }}>
              <span className="series-nav__arrow-label">下一篇</span>
              <span className="series-nav__arrow-title">{next.title}</span>
            </div>
            <ChevronRight className="series-nav__arrow-icon" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
