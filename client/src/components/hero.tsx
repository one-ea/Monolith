export function LegacyHero() {
  return (
    <section className="relative border-b border-border/20 py-[44px] sm:py-[56px] lg:py-[68px]">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-45" />
      <div className="relative grid gap-[28px] lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
        <div className="min-w-0">
          <div className="mb-[20px] flex items-center gap-[12px] animate-fade-in">
            <div className="relative flex h-[56px] w-[28px] shrink-0 items-center justify-center rounded-[4px] border border-border/25 bg-foreground/[0.06]">
              <div className="h-[42px] w-[16px] rounded-[3px] bg-gradient-to-b from-foreground/88 to-foreground/38 shadow-[0_18px_44px_oklch(0_0_0_/_18%)]" />
            </div>
            <div className="h-px flex-1 bg-border/25" />
            <span className="hidden font-mono text-[11px] text-muted-foreground/45 sm:inline">EDGE / DESIGN / CODE</span>
          </div>

          <h1 className="max-w-[760px] animate-blur-in delay-1 font-heading text-[40px] font-semibold leading-[0.95] tracking-[-0.045em] text-foreground sm:text-[56px] lg:text-[72px]">
            Monolith
          </h1>
          <p className="mt-[18px] hidden w-full max-w-[620px] whitespace-normal break-words [word-break:break-all] animate-fade-in-up delay-2 text-[17px] leading-[1.8] text-muted-foreground sm:block">
            书写代码、设计系统与边缘计算的个人技术档案。以更清晰的网格组织阅读路径，让文章、标签和长期主题更容易被发现。
          </p>
          <p className="mt-[18px] animate-fade-in-up delay-2 text-[16px] leading-[1.75] text-muted-foreground sm:hidden">
            <span className="block">书写代码、设计系统与边缘计算。</span>
            <span className="block">以清晰网格组织阅读路径。</span>
            <span className="block">让文章、标签和长期主题更容易被发现。</span>
          </p>
        </div>

        <div className="animate-fade-in-up delay-3 rounded-md border border-border/20 bg-background/45 p-[16px] backdrop-blur-sm">
          <p className="font-mono text-[11px] text-muted-foreground/40">CURRENT FOCUS</p>
          <div className="mt-[14px] space-y-[10px]">
            {["工程笔记", "设计观察", "边缘计算"].map((item) => (
              <div key={item} className="flex min-h-[32px] items-center justify-between border-b border-border/12 last:border-b-0">
                <span className="text-[13px] text-foreground/82">{item}</span>
                <span className="h-[6px] w-[6px] rounded-full bg-foreground/38" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export type HeroTopic = {
  title: string;
  desc: string;
};

export type HeroAction = {
  label: string;
  href: string;
};

type HeroProps = {
  title?: string;
  kicker?: string;
  subtitle?: string;
  description?: string;
  actions?: HeroAction[];
  topics?: HeroTopic[];
};

const DEFAULT_ACTIONS: HeroAction[] = [
  { label: "最新文章", href: "#latest-posts" },
  { label: "主题索引", href: "#content-index" },
  { label: "工程笔记", href: "/archive" },
];

const DEFAULT_TOPICS: HeroTopic[] = [
  { title: "系统设计", desc: "从边界、接口和运维成本切入" },
  { title: "阅读体验", desc: "让长文、代码与目录保持同一节奏" },
  { title: "边缘部署", desc: "Workers / D1 / R2 的真实工程路径" },
];

export function Hero({
  title = "Monolith",
  kicker = "EDGE JOURNAL / CODE ARCHIVE",
  subtitle = "技术写作、系统设计与边缘实践的索引页",
  description = "用更冷静的网格整理长期主题：前端架构、设计系统、边缘计算与工程排障。每一篇文章都尽量给出可复用的上下文，而不是只留下零散记录。",
  actions = DEFAULT_ACTIONS,
  topics = DEFAULT_TOPICS,
}: HeroProps) {
  const visibleActions = actions.filter((item) => item.label.trim() && item.href.trim()).slice(0, 3);
  const visibleTopics = topics.filter((item) => item.title.trim() && item.desc.trim()).slice(0, 3);

  return (
    <section className="relative border-b border-border/18 py-[40px] sm:py-[52px] lg:py-[64px]">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-35" />
      <div className="relative grid gap-[24px] lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
        <div className="min-w-0 border-l border-border/35 pl-[16px] sm:pl-[20px]">
          <div className="mb-[20px] flex items-center gap-[12px]">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-muted-foreground/45">{kicker}</p>
              <p className="mt-[4px] text-[12px] text-muted-foreground/42">{subtitle}</p>
            </div>
          </div>

          <h1 className="max-w-[820px] font-heading text-[42px] font-semibold leading-[0.96] tracking-[-0.045em] text-foreground sm:text-[60px] lg:text-[76px]">
            {title}
          </h1>
          <p className="mt-[20px] max-w-[660px] text-[16px] leading-[1.85] text-muted-foreground sm:text-[17px]">
            {description}
          </p>

          <div className="mt-[24px] flex flex-wrap gap-[8px]">
            {visibleActions.map((item) => (
              <a
                key={`${item.label}-${item.href}`}
                href={item.href}
                className="inline-flex min-h-[44px] items-center rounded-md border border-border/18 bg-background/32 px-[12px] text-[13px] text-muted-foreground/72 transition-all duration-200 hover:-translate-y-[2px] hover:border-border/36 hover:bg-card/22 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-[36px]"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-[10px] rounded-md border border-border/20 bg-background/35 p-[14px] backdrop-blur-sm">
          <p className="font-mono text-[11px] text-muted-foreground/42">CURRENT THREADS</p>
          {visibleTopics.map((item) => (
            <div key={item.title} className="rounded-md border border-border/14 bg-card/[0.10] px-[12px] py-[10px]">
              <div className="flex items-center justify-between gap-[12px]">
                <span className="text-[13px] font-medium text-foreground/86">{item.title}</span>
                <span className="h-[6px] w-[6px] rounded-full bg-foreground/42" />
              </div>
              <p className="mt-[6px] text-[12px] leading-[1.6] text-muted-foreground/55">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
