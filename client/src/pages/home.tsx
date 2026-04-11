import React, { useEffect, useState } from "react";
import { Hero } from "@/components/hero";
import { ArticleCard } from "@/components/article-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchPosts, type PostMeta } from "@/lib/api";
import { AnimateIn } from "@/hooks/use-animate";
import { SeoHead } from "@/components/seo-head";
import { ExternalLink, Mail, Rss, Eye } from "lucide-react";

type PublicSettings = {
  site_title: string;
  site_description: string;
  site_tagline: string;
  author_name: string;
  author_title: string;
  author_bio: string;
  author_avatar: string;
  github_url: string;
  twitter_url: string;
  email: string;
  rss_enabled: string;
};

type TrafficData = {
  totalViews: number;
  totalPosts: number;
  chart: { date: string; count: number }[];
};

/* ── 纯 SVG 迷你折线图 ── */
function SparkLine({ data, width = 240, height = 48 }: { data: number[]; width?: number; height?: number }) {
  const gradId = `sparkGrad-${React.useId().replace(/:/g, "")}`;
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pad = 2;
  const step = (width - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * step;
    const y = height - pad - ((v / max) * (height - pad * 2));
    return `${x},${y}`;
  });
  const polyline = points.join(" ");
  const areaPath = `M${pad},${height - pad} ${points.map((p) => `L${p}`).join(" ")} L${pad + (data.length - 1) * step},${height - pad} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.75 0.15 220)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.75 0.15 220)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline fill="none" stroke="oklch(0.75 0.15 220)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
      {/* 末端圆点 */}
      {data.length > 0 && (
        <circle cx={pad + (data.length - 1) * step} cy={height - pad - ((data[data.length - 1] / max) * (height - pad * 2))} r="2.5" fill="oklch(0.75 0.15 220)" />
      )}
    </svg>
  );
}

export function HomePage() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);

  useEffect(() => {
    fetchPosts()
      .then(setPosts)
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => {});

    fetch("/api/stats/traffic")
      .then((r) => r.json())
      .then((data) => setTraffic(data))
      .catch(() => {});
  }, []);

  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags)));

  const authorName = settings?.author_name || "Monolith";
  const authorTitle = settings?.author_title || "独立开发者";
  const authorBio = settings?.author_bio || "热衷于前端架构、设计系统与边缘计算。相信技术应当服务于人，而非反过来。";
  const authorAvatar = settings?.author_avatar || "";

  // 社交链接（只在有实质性社交信息时显示此行）
  const socialLinks: { icon: React.ElementType; href: string; label: string }[] = [];
  if (settings?.github_url) socialLinks.push({ icon: ExternalLink, href: settings.github_url, label: "GitHub" });
  if (settings?.email) socialLinks.push({ icon: Mail, href: `mailto:${settings.email}`, label: "邮箱" });
  if (socialLinks.length > 0 && settings?.rss_enabled !== "false") socialLinks.push({ icon: Rss, href: "/rss.xml", label: "RSS" });

  return (
    <div className="flex flex-col">
      <SeoHead url="/" />
      <Hero />
      <Separator className="bg-border/30" />
      <div className="grid grid-cols-1 gap-[32px] py-[40px] lg:grid-cols-[1fr_280px] lg:gap-[40px]">
        <section>
          <AnimateIn>
            <h2 className="mb-[24px] text-[14px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">最新文章</h2>
          </AnimateIn>
          {loading ? (
            <div className="flex flex-col gap-[16px]">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[180px] animate-pulse rounded-lg bg-card/20" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-[16px]">
              {posts.map((post, i) => (
                <AnimateIn key={post.slug} delay={`delay-${Math.min(i, 6)}`}>
                  <ArticleCard post={post} />
                </AnimateIn>
              ))}
            </div>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-[72px] flex flex-col gap-[24px]">
            {/* ── 博主名片 ── */}
            <AnimateIn animation="animate-fade-in" delay="delay-2">
              <div className="rounded-lg border border-border/40 bg-card/30 p-[20px]">
                <div className="mb-[12px] flex items-center gap-[12px]">
                  {authorAvatar ? (
                    <img
                      src={authorAvatar}
                      alt={authorName}
                      className="h-[40px] w-[40px] rounded-full object-cover border border-border/30"
                    />
                  ) : (
                    <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 text-[15px] font-semibold text-foreground">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">{authorName}</p>
                    <p className="text-[12px] text-muted-foreground/60">{authorTitle}</p>
                  </div>
                </div>
                <p className="text-[13px] leading-[1.7] text-muted-foreground">{authorBio}</p>

                {/* 社交链接图标行 */}
                {socialLinks.length > 0 && (
                  <div className="mt-[14px] flex items-center gap-[12px] border-t border-border/20 pt-[14px]">
                    {socialLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target={link.href.startsWith("http") ? "_blank" : undefined}
                        rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        title={link.label}
                        className="flex h-[28px] w-[28px] items-center justify-center rounded-md text-muted-foreground/40 transition-colors duration-200 hover:bg-accent hover:text-foreground"
                      >
                        <link.icon className="h-[14px] w-[14px]" />
                      </a>
                    ))}
                    {posts.length > 0 && (
                      <span className="ml-auto text-[11px] text-muted-foreground/30">{posts.length} 篇文章</span>
                    )}
                  </div>
                )}
              </div>
            </AnimateIn>

            {/* ── 标签云（无标签时隐藏） ── */}
            {allTags.length > 0 && (
              <AnimateIn animation="animate-fade-in" delay="delay-3">
                <div className="rounded-lg border border-border/40 bg-card/30 p-[20px]">
                  <h3 className="mb-[12px] text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground/60">标签</h3>
                  <div className="flex flex-wrap gap-[6px]">
                    {allTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="h-[24px] rounded-[4px] px-[8px] text-[12px] font-normal text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground cursor-pointer">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </AnimateIn>
            )}

            {/* ── 访问趋势 ── */}
            <AnimateIn animation="animate-fade-in" delay="delay-4">
              <div className="rounded-lg border border-border/40 bg-card/30 p-[20px]">
                <div className="flex items-center justify-between mb-[12px]">
                  <h3 className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground/60">访问趋势</h3>
                  <span className="text-[10px] text-muted-foreground/20">14 日</span>
                </div>
                {traffic?.chart && traffic.chart.some((d) => d.count > 0) ? (
                  <>
                    <div className="mb-[10px] flex items-baseline gap-[6px]">
                      <span className="text-[24px] font-bold leading-none tracking-tight text-foreground">{(traffic.totalViews).toLocaleString()}</span>
                      <span className="text-[11px] text-muted-foreground/30">次访问</span>
                    </div>
                    <SparkLine data={traffic.chart.map((d) => d.count)} />
                  </>
                ) : (
                  <div className="flex items-center gap-[6px] py-[8px]">
                    <Eye className="h-[13px] w-[13px] text-muted-foreground/15" />
                    <span className="text-[12px] text-muted-foreground/20">暂无访问数据</span>
                  </div>
                )}
              </div>
            </AnimateIn>

            {/* ── 技术栈 ── */}
            <AnimateIn animation="animate-fade-in" delay="delay-5">
              <div className="rounded-lg border border-border/40 bg-card/30 p-[20px]">
                <h3 className="mb-[12px] text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground/60">技术栈</h3>
                <div className="flex flex-col gap-[7px] text-[13px]">
                  <div className="flex justify-between"><span className="text-muted-foreground/70">前端</span><span className="font-medium text-foreground">React 19</span></div>
                  <Separator className="bg-border/15" />
                  <div className="flex justify-between"><span className="text-muted-foreground/70">构建</span><span className="font-medium text-foreground">Vite 6</span></div>
                  <Separator className="bg-border/15" />
                  <div className="flex justify-between"><span className="text-muted-foreground/70">样式</span><span className="font-medium text-foreground">Tailwind v4</span></div>
                  <Separator className="bg-border/15" />
                  <div className="flex justify-between"><span className="text-muted-foreground/70">后端</span><span className="font-medium text-foreground">Hono</span></div>
                  <Separator className="bg-border/15" />
                  <div className="flex justify-between"><span className="text-muted-foreground/70">数据库</span><span className="font-medium text-foreground">Cloudflare D1</span></div>
                  <Separator className="bg-border/15" />
                  <div className="flex justify-between"><span className="text-muted-foreground/70">存储</span><span className="font-medium text-foreground">Cloudflare R2</span></div>
                  <Separator className="bg-border/15" />
                  <div className="flex justify-between"><span className="text-muted-foreground/70">部署</span><span className="font-medium text-foreground">Workers + Pages</span></div>
                </div>
              </div>
            </AnimateIn>
          </div>
        </aside>
      </div>
    </div>
  );
}
