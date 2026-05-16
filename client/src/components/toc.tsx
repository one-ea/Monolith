import { useState, useEffect, useCallback, useRef } from "react";
import { List, ChevronRight } from "lucide-react";
import type { TocHeading } from "@/lib/markdown";

type Props = {
  headings: TocHeading[];
};

/**
 * 文章目录组件（Table of Contents）
 * - 桌面端：文章右侧固定浮动
 * - 移动端：折叠为顶部下拉按钮
 * - 使用 IntersectionObserver 实时追踪当前章节
 * - 点击平滑滚动到目标位置
 */
export function TableOfContents({ headings }: Props) {
  const [activeId, setActiveId] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // IntersectionObserver 追踪当前可见标题
  useEffect(() => {
    if (headings.length === 0) return;

    // 延迟一帧，确保 DOM 中标题元素已渲染
    const timer = setTimeout(() => {
      const elements = headings
        .map((h) => document.getElementById(h.id))
        .filter(Boolean) as HTMLElement[];

      if (elements.length === 0) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          // 找到最上方进入视口的标题
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible.length > 0) {
            setActiveId(visible[0].target.id);
          }
        },
        {
          rootMargin: "-80px 0px -60% 0px",
          threshold: 0.1,
        }
      );

      elements.forEach((el) => observerRef.current?.observe(el));
    }, 200);

    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [headings]);

  // 点击目录项：平滑滚动
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      setMobileOpen(false);
    }
  }, []);

  if (headings.length < 2) return null;

  // 计算最小层级用于缩进
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <>
      {/* ─── 桌面端：侧边固定 TOC ─── */}
      <nav className="toc-desktop hidden xl:block">
        <div className="sticky top-[100px]">
          <h4 className="mb-[12px] flex items-center gap-[6px] text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/40">
            <List className="h-[12px] w-[12px]" />
            目录
          </h4>
          <ul className="toc-list space-y-[2px]">
            {headings.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => scrollTo(h.id)}
                  className={`toc-item toc-level-${h.level - minLevel} ${
                    activeId === h.id ? "toc-active" : ""
                  }`}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ─── 移动端：折叠按钮 + 下拉菜单 ─── */}
      <div className="toc-mobile xl:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="inline-flex min-h-[44px] items-center gap-[6px] rounded-md border border-border/30 bg-card/40 px-[12px] text-[12px] text-muted-foreground transition-all duration-200 hover:bg-card/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-[34px]"
          aria-expanded={mobileOpen}
        >
          <List className="h-[13px] w-[13px]" />
          目录
          <ChevronRight className={`h-[12px] w-[12px] transition-transform duration-200 ${mobileOpen ? "rotate-90" : ""}`} />
        </button>

        {mobileOpen && (
          <div className="mt-[8px] rounded-md border border-border/30 bg-card/60 p-[12px] backdrop-blur-xl animate-fade-in">
            <ul className="toc-list space-y-[1px]">
              {headings.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => scrollTo(h.id)}
                    className={`toc-item toc-level-${h.level - minLevel} ${
                      activeId === h.id ? "toc-active" : ""
                    }`}
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * 阅读进度条组件
 * 显示在页面顶部，随页面滚动变化宽度
 */
export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setProgress(Math.min((scrollTop / docHeight) * 100, 100));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="reading-progress-bar" style={{ width: `${progress}%` }} />
  );
}
