export function Hero() {
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
