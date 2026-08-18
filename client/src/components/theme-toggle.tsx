import { useState, useEffect, useRef, type ComponentType } from "react";
import {
  Moon,
  Sun,
  Monitor,
  Droplets,
  Palette,
  Check,
} from "lucide-react";

type PaletteMode = "dark" | "light" | "system";
type ThemeStyle = "default" | "fluid";

const STYLE_KEY = "monolith-theme-style";

const STYLE_OPTIONS: {
  id: ThemeStyle;
  name: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "default", name: "简洁", desc: "当前默认主题", icon: Palette },
  { id: "fluid", name: "液态玻璃", desc: "流体光斑 · 玻璃质感", icon: Droplets },
];

const MODE_OPTIONS: {
  id: PaletteMode;
  name: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "dark", name: "暗色", icon: Moon },
  { id: "light", name: "亮色", icon: Sun },
  { id: "system", name: "跟随系统", icon: Monitor },
];

/** 根据 mode 获取实际生效的明暗模式 */
function getEffectiveMode(mode: PaletteMode): "dark" | "light" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

/** 将 明暗模式 × 视觉风格 应用到 DOM + theme-color */
function applyTheme(mode: PaletteMode, style: ThemeStyle) {
  const effective = getEffectiveMode(mode);
  document.documentElement.setAttribute("data-theme", effective);
  document.documentElement.setAttribute("data-style", style);
  const themeColor =
    style === "fluid"
      ? effective === "light"
        ? "#f6f4fb"
        : "#0d0b1a"
      : effective === "light"
        ? "#ffffff"
        : "#0a0a0f";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeColor);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<PaletteMode>(() => {
    return (localStorage.getItem("theme") as PaletteMode) || "dark";
  });
  const [style, setStyle] = useState<ThemeStyle>(() => {
    return (localStorage.getItem(STYLE_KEY) as ThemeStyle) || "default";
  });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 应用主题（模式或风格变化时）
  useEffect(() => {
    applyTheme(mode, style);
    localStorage.setItem("theme", mode);
    localStorage.setItem(STYLE_KEY, style);
  }, [mode, style]);

  // system 模式下监听系统明暗变化
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") applyTheme("system", style);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode, style]);

  // 点击外部关闭面板
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const CurrentIcon = style === "fluid" ? Droplets : Palette;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="主题设置"
        aria-label="主题设置"
        aria-expanded={open}
        className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-muted-foreground/55 transition-all duration-200 hover:bg-accent/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-[32px] sm:w-[32px]"
      >
        <CurrentIcon className="h-[16px] w-[16px] transition-transform duration-300" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[90] mt-2 w-[min(78vw,268px)] origin-top-right rounded-xl border border-border/60 bg-popover/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl animate-scale-in">
          <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            视觉风格
          </p>
          <div className="grid gap-1">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                aria-pressed={style === s.id}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all duration-200 ${
                  style === s.id
                    ? "border-border bg-accent/40"
                    : "border-border/50 hover:bg-accent/20"
                }`}
              >
                <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-tight">
                    {s.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {s.desc}
                  </span>
                </span>
                {style === s.id && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />
                )}
              </button>
            ))}
          </div>

          <p className="px-1 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            明暗模式
          </p>
          <div className="grid grid-cols-3 gap-1">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] transition-all duration-200 ${
                  mode === m.id
                    ? "border-border bg-accent/40 text-foreground"
                    : "border-border/50 text-muted-foreground hover:bg-accent/20"
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}