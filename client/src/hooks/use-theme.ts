import { useCallback, useEffect, useState } from "react";
import { getTheme, normalizeTheme, setTheme, THEME_EVENT, THEMES, type Theme } from "@/lib/theme/theme";

/**
 * 设计语言主题 Hook（任务书 §21）。
 * const { theme, setTheme, themes } = useTheme();
 * 切换只改 data-theme 与持久化缓存，不刷新、不影响路由与业务状态。
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    window.addEventListener(THEME_EVENT, sync);
    // 多标签页同步
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const updateTheme = useCallback((next: Theme | string) => {
    const normalized = normalizeTheme(next);
    setTheme(normalized);
    setThemeState(normalized);
  }, []);

  return { theme, setTheme: updateTheme, themes: THEMES };
}
