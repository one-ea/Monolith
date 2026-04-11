export function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center py-[60px] lg:py-[80px] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-radial from-blue-500/[0.07] via-cyan-500/[0.04] to-transparent rounded-full blur-3xl animate-fade-in" />
      </div>
      <div className="relative mb-[24px] animate-scale-in delay-0">
        <div className="h-[56px] w-[28px] rounded-[4px] bg-gradient-to-b from-foreground/80 to-foreground/40 shadow-[0_0_40px_rgba(255,255,255,0.06)]" />
        <div className="absolute -inset-[8px] rounded-[8px] bg-foreground/[0.03] blur-xl" />
      </div>
      <h1 className="text-center text-[36px] font-semibold tracking-[-0.03em] leading-tight lg:text-[44px] animate-blur-in delay-1">Monolith</h1>
      <p className="mt-[12px] max-w-[480px] text-center text-[15px] leading-relaxed text-muted-foreground animate-fade-in-up delay-2">
        书写代码、设计与边缘计算的个人博客。
        <br />
        <span className="text-muted-foreground/60">在秩序与混沌的交界处，寻找属于自己的巨石碑。</span>
      </p>

    </section>
  );
}
