/* ═══════════════════════════════════════════════════════════════════
   Monolith Design System · Theme Engine（Phase 3）
   双轴主题模型（2026-09-28 定稿）：
     data-mode  = dark | light        明暗（设置支持 system，应用时解析）
     data-theme = apple | pixel | classic
                                       设计语言：classic = GitHub Primer 基线
                                       （默认，原观感兜底块）；apple = HIG ·
                                       Liquid Glass（接替原 fluid 玻璃风格）；
                                       pixel = Material 3 Expressive。
   原 data-style(液态玻璃) 轴已于 2026-09-28 移除，其玻璃角色由 Apple Theme 承担。
   持久化：cookie `monolith_site_theme`；新格式 mode|design，兼容旧
   mode|style|design 与 mode|style（style 段忽略、design 回退 classic）。
   ═══════════════════════════════════════════════════════════════════ */

/** 设计语言主题（任务书 Theme API；classic = 迁移前的 GitHub Primer 基线） */
export type Theme = "apple" | "pixel" | "classic";
export type SiteThemeMode = "dark" | "light" | "system";
export type SiteThemeDesign = Theme;

export const THEMES: Theme[] = ["classic", "apple", "pixel"];
export const DEFAULT_THEME: Theme = "classic";

const THEME_COOKIE = "monolith_site_theme";
const THEME_EVENT = "monolith:theme-change";

const THEME_COLOR: Record<"dark" | "light", Record<Theme, string>> = {
  dark: { apple: "#141418", pixel: "#16121c", classic: "#0d1117" },
  light: { apple: "#f5f5f7", pixel: "#fbf7ff", classic: "#ffffff" },
};

export function normalizeTheme(value: unknown): Theme {
  return value === "apple" ? "apple" : value === "pixel" ? "pixel" : "classic";
}

export function normalizeSiteThemeMode(value: unknown): SiteThemeMode {
  return value === "light" || value === "system" ? value : "dark";
}

/** 根据 mode 获取实际生效的明暗模式 */
function effectiveThemeMode(mode: SiteThemeMode): "dark" | "light" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export interface SiteThemeState {
  mode: SiteThemeMode;
  design: Theme;
}

/** 将 明暗 × 设计语言 应用到 DOM + theme-color，并同步首屏缓存 cookie */
export function applySiteTheme(mode: SiteThemeMode, design: Theme = DEFAULT_THEME): void {
  const effective = effectiveThemeMode(mode);
  const root = document.documentElement;
  root.setAttribute("data-mode", effective);
  root.setAttribute("data-theme", design);
  // 清理历史版本遗留的风格轴属性（fluid 已移除）
  root.removeAttribute("data-style");

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[effective][design]);
  writeThemeCookie(mode, design);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { mode, design } }));
}

/** 读取当前生效的设计语言（data-theme；缺省回退 classic） */
export function getTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return normalizeTheme(document.documentElement.getAttribute("data-theme"));
}

/** 任务书 §21 API：setTheme("classic" | "apple" | "pixel")，保留当前明暗，无需刷新 */
export function setTheme(theme: Theme): void {
  const current = readThemeCookie() ?? { mode: "dark", design: DEFAULT_THEME };
  applySiteTheme(current.mode, theme);
}

/** 读取首屏缓存的主题（与 index.html 内联脚本解析逻辑保持一致；兼容旧 cookie 格式） */
export function readThemeCookie(): SiteThemeState | null {
  const match = document.cookie.match(/(?:^|;\s*)monolith_site_theme=([^;]+)/);
  if (!match) return null;
  try {
    const parts = decodeURIComponent(match[1]).split("|");
    if (!parts[0]) return null;
    // mode|design（现行）｜mode|style|design（过渡期）｜mode|style（最旧，design 回退）
    const design = parts.length >= 3 ? parts[2] : parts[1] && parts[1] !== "default" && parts[1] !== "fluid" ? parts[1] : undefined;
    return {
      mode: normalizeSiteThemeMode(parts[0]),
      design: normalizeTheme(design),
    };
  } catch {
    return null;
  }
}

function writeThemeCookie(mode: SiteThemeMode, design: Theme): void {
  try {
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(`${mode}|${design}`)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // cookie 写入失败不影响本次会话的主题生效
  }
}

export { THEME_EVENT };
