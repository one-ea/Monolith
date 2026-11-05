/**
 * 兼容出口：主题引擎已升级为双轴（mode × design）并迁移到
 * `lib/theme/theme.ts`。存量引用经此文件转发，新代码请直接引用 @/lib/theme。
 */
export {
  applySiteTheme,
  getTheme,
  setTheme,
  readThemeCookie,
  normalizeTheme,
  normalizeSiteThemeMode,
} from "@/lib/theme/theme";
export type { Theme, SiteThemeMode, SiteThemeDesign } from "@/lib/theme/theme";
