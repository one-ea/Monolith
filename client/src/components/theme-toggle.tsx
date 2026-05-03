import { useState, useEffect, useCallback } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

type Theme = "dark" | "light" | "system";

/** 根据 data-theme 获取实际生效的主题 */
function getEffectiveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

/** 将主题应用到 DOM + theme-color */
function applyTheme(theme: Theme) {
  const effective = getEffectiveTheme(theme);
  document.documentElement.setAttribute("data-theme", effective);
  // 同步浏览器地址栏颜色
  const themeColor = effective === "light" ? "#ffffff" : "#0a0a0f";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeColor);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "dark";
  });

  // 应用主题
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // 监听系统主题变化（仅 system 模式下生效）
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : prev === "light" ? "system" : "dark"));
  }, []);

  const icons = { dark: Moon, light: Sun, system: Monitor };
  const labels = { dark: "暗色", light: "亮色", system: "跟随系统" };
  const Icon = icons[theme as keyof typeof icons] || Monitor;

  return (
    <button
      onClick={cycle}
      title={`当前：${labels[theme as keyof typeof labels]}，点击切换`}
      className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-muted-foreground/55 transition-all duration-200 hover:bg-accent/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-[32px] sm:w-[32px]"
      aria-label="切换主题"
    >
      <Icon className="h-[16px] w-[16px] transition-transform duration-300" />
    </button>
  );
}
