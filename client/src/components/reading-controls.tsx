import { useState, useEffect, useCallback, useRef } from "react";
import { Settings, X, Minus, Plus, Type, Moon, Sun, Monitor, Minimize, BookOpen } from "lucide-react";

export type ReadingTheme = "light" | "sepia" | "dark" | "system";
export type FontFamily = "sans" | "serif";

export interface ReadingPreferences {
  theme: ReadingTheme;
  fontFamily: FontFamily;
  fontSize: number; // base font size, default 17
  lineHeight: number; // base line height, default 2.0
  maxWidth: number; // max width of the container, default 780
}

const DEFAULT_PREFERENCES: ReadingPreferences = {
  theme: "system",
  fontFamily: "sans",
  fontSize: 17,
  lineHeight: 2.0,
  maxWidth: 780,
};

const STORAGE_KEY = "monolith_reading_preferences";

export function useReadingPreferences() {
  const [preferences, setPreferences] = useState<ReadingPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PREFERENCES;
  });

  const updatePreference = useCallback(<K extends keyof ReadingPreferences>(key: K, value: ReadingPreferences[K]) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { preferences, updatePreference };
}

export function ReadingControls({
  isActive,
  onClose,
  preferences,
  updatePreference,
}: {
  isActive: boolean;
  onClose: () => void;
  preferences: ReadingPreferences;
  updatePreference: <K extends keyof ReadingPreferences>(key: K, value: ReadingPreferences[K]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside to close the config panel
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  if (!isActive) return null;

  return (
    <div
      ref={wrapperRef}
      className={`fixed bottom-[24px] right-[24px] z-50 flex flex-col items-end gap-[12px] opacity-0 animate-fade-in-up md:bottom-[40px] md:right-[40px]`}
      style={{ animationFillMode: "forwards" }}
    >
      {/* 选项面板 (Popover) */}
      {isOpen && (
        <div className="w-[280px] origin-bottom-right rounded-md border border-border/30 bg-card/88 p-[18px] shadow-2xl backdrop-blur-xl animate-scale-in">
          <div className="mb-[16px] flex items-center justify-between">
            <span className="text-[14px] font-medium tracking-normal">阅读偏好</span>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="关闭阅读偏好"
            >
              <X className="h-[14px] w-[14px]" />
            </button>
          </div>

          <div className="space-y-[20px] text-[13px]">
            {/* 主题选择 */}
            <div className="space-y-[8px]">
              <span className="text-[12px] text-muted-foreground/60">背景主题</span>
              <div className="grid grid-cols-4 gap-[8px]">
                <button
                  onClick={() => updatePreference("theme", "light")}
                  className={`flex h-[44px] items-center justify-center rounded-md border bg-[#f8f9fa] text-[#333] transition-all hover:border-[#aaa] ${preferences.theme === "light" ? "border-foreground ring-1 ring-foreground/55" : "border-transparent"}`}
                  title="白昼"
                ><Sun className="h-[14px] w-[14px]" /></button>
                <button
                  onClick={() => updatePreference("theme", "sepia")}
                  className={`flex h-[44px] items-center justify-center rounded-md border bg-[#f4ece3] text-[#5b4a3a] transition-all hover:border-[#d4c6b3] ${preferences.theme === "sepia" ? "border-amber-500 shadow-[0_0_0_1px_theme(colors.amber.500)]" : "border-transparent"}`}
                  title="羊皮纸"
                ><BookOpen className="h-[14px] w-[14px]" /></button>
                <button
                  onClick={() => updatePreference("theme", "dark")}
                  className={`flex h-[44px] items-center justify-center rounded-md border bg-[#1a1a1c] text-[#e0e0e0] transition-all hover:border-[#444] ${preferences.theme === "dark" ? "border-foreground ring-1 ring-foreground/55" : "border-transparent"}`}
                  title="深渊"
                ><Moon className="h-[14px] w-[14px]" /></button>
                <button
                  onClick={() => updatePreference("theme", "system")}
                  className={`flex h-[44px] items-center justify-center rounded-md border bg-accent/20 text-foreground transition-all hover:bg-accent/40 ${preferences.theme === "system" ? "border-foreground ring-1 ring-foreground/55" : "border-transparent"}`}
                  title="跟随系统"
                ><Monitor className="h-[14px] w-[14px]" /></button>
              </div>
            </div>

            {/* 字体选择 */}
            <div className="space-y-[8px]">
              <span className="text-[12px] text-muted-foreground/60">字体样式</span>
              <div className="grid grid-cols-2 gap-[8px]">
                <button
                  onClick={() => updatePreference("fontFamily", "sans")}
                  className={`flex h-[44px] items-center justify-center rounded-md border bg-accent/10 transition-all hover:bg-accent/30 ${preferences.fontFamily === "sans" ? "border-foreground/50 text-foreground" : "border-border/30 text-muted-foreground"}`}
                >
                  <span className="font-sans">无衬线体</span>
                </button>
                <button
                  onClick={() => updatePreference("fontFamily", "serif")}
                  className={`flex h-[44px] items-center justify-center rounded-md border bg-accent/10 transition-all hover:bg-accent/30 ${preferences.fontFamily === "serif" ? "border-foreground/50 text-foreground" : "border-border/30 text-muted-foreground"}`}
                >
                  <span className="font-serif">衬线体</span>
                </button>
              </div>
            </div>

            {/* 字号行距调整 */}
            <div className="space-y-[8px]">
              <span className="text-[12px] text-muted-foreground/60">排版 (A: {preferences.fontSize} / H: {preferences.lineHeight.toFixed(1)})</span>
              <div className="grid grid-cols-2 gap-[16px]">
                {/* 字号 */}
                <div className="flex h-[44px] items-center justify-between rounded-md border border-border/30 bg-accent/10 px-[12px]">
                  <button onClick={() => updatePreference("fontSize", Math.max(14, preferences.fontSize - 1))} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent/30 hover:text-foreground">
                    <Minus className="h-[12px] w-[12px]" />
                  </button>
                  <Type className="h-[14px] w-[14px] text-muted-foreground/50" />
                  <button onClick={() => updatePreference("fontSize", Math.min(24, preferences.fontSize + 1))} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent/30 hover:text-foreground">
                    <Plus className="h-[12px] w-[12px]" />
                  </button>
                </div>
                {/* 行距 */}
                <div className="flex h-[44px] items-center justify-between rounded-md border border-border/30 bg-accent/10 px-[12px]">
                  <button onClick={() => updatePreference("lineHeight", Math.max(1.4, Number((preferences.lineHeight - 0.1).toFixed(1))))} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent/30 hover:text-foreground">
                    <Minus className="h-[12px] w-[12px]" />
                  </button>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground/50">Hgt</span>
                  <button onClick={() => updatePreference("lineHeight", Math.min(3.0, Number((preferences.lineHeight + 0.1).toFixed(1))))} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent/30 hover:text-foreground">
                    <Plus className="h-[12px] w-[12px]" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* 专注宽度 */}
            <div className="space-y-[8px]">
              <span className="text-[12px] text-muted-foreground/60">阅读区宽度</span>
              <div className="flex h-[44px] items-center justify-between rounded-md border border-border/30 bg-accent/10 px-[12px]">
                <button title="收窄" onClick={() => updatePreference("maxWidth", Math.max(500, preferences.maxWidth - 50))} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent/30 hover:text-foreground">
                  <Minus className="h-[12px] w-[12px]" />
                </button>
                <span className="text-[11px] font-mono text-muted-foreground/80">{preferences.maxWidth}px</span>
                <button title="变宽" onClick={() => updatePreference("maxWidth", Math.min(1200, preferences.maxWidth + 50))} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent/30 hover:text-foreground">
                  <Plus className="h-[12px] w-[12px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 悬浮操作按钮组 */}
      <div className="flex flex-col items-center gap-[12px] rounded-full border border-border/30 bg-card/60 p-[6px] shadow-lg backdrop-blur-xl transition-all hover:bg-card/80 hover:shadow-xl hover:border-border/50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-[40px] w-[40px] items-center justify-center rounded-full transition-all ${isOpen ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-accent/40"}`}
          title="排版设置"
        >
          <Settings className={`h-[18px] w-[18px] ${isOpen ? "rotate-90 transition-transform duration-300" : ""}`} />
        </button>
        <div className="h-[1px] w-[20px] bg-border/40" />
        <button
          onClick={onClose}
          className="group flex h-[40px] w-[40px] items-center justify-center rounded-full bg-transparent transition-all hover:bg-red-500/10"
          title="退出阅读模式 (ESC)"
        >
          <Minimize className="h-[18px] w-[18px] text-muted-foreground transition-colors group-hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}
