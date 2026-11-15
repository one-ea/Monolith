import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applySiteTheme, normalizeTheme, normalizeSiteThemeMode } from "@/lib/site-theme";

export type SiteDatePrecision = "date" | "datetime" | "datetime_seconds";

export type SiteDateSettings = {
  timezone: string;
  datePrecision: SiteDatePrecision;
};

export type PublicSiteSettings = {
  site_title: string;
  site_description: string;
  site_tagline: string;
  hero_kicker: string;
  hero_subtitle: string;
  hero_description: string;
  hero_actions: string;
  hero_topics: string;
  site_icon: string;
  site_og_image: string;
  author_name: string;
  author_title: string;
  author_bio: string;
  author_avatar: string;
  github_url: string;
  twitter_url: string;
  email: string;
  social_links: string;
  footer_text: string;
  rss_enabled: string;
  custom_header: string;
  custom_footer: string;
  custom_snippets: string;
  site_timezone: string;
  date_precision: string;
  site_theme_mode: string;
  site_theme_design: string;
};

const DEFAULT_SITE_SETTINGS: PublicSiteSettings = {
  site_title: "Monolith",
  site_description: "书写代码、设计与边缘计算的个人博客。",
  site_tagline: "在秩序与混沌的交界处，寻找属于自己的巨石碑。",
  hero_kicker: "EDGE JOURNAL / CODE ARCHIVE",
  hero_subtitle: "技术写作、系统设计与边缘实践的索引页",
  hero_description: "用更冷静的网格整理长期主题：前端架构、设计系统、边缘计算与工程排障。",
  hero_actions: "",
  hero_topics: "",
  site_icon: "",
  site_og_image: "",
  author_name: "Monolith",
  author_title: "独立开发者",
  author_bio: "",
  author_avatar: "",
  github_url: "",
  twitter_url: "",
  email: "",
  social_links: "",
  footer_text: "",
  rss_enabled: "true",
  custom_header: "",
  custom_footer: "",
  custom_snippets: "",
  site_timezone: "Asia/Shanghai",
  date_precision: "date",
  site_theme_mode: "dark",
  site_theme_design: "classic",
};

type SiteSettingsContextValue = {
  settings: PublicSiteSettings;
  dateSettings: SiteDateSettings;
  ready: boolean;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

function normalizeDatePrecision(value: string): SiteDatePrecision {
  if (value === "datetime_seconds") return "datetime_seconds";
  return value === "datetime" ? "datetime" : "date";
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSiteSettings>(DEFAULT_SITE_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

    fetch("/api/settings/public", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("settings request failed");
        return response.json() as Promise<Partial<PublicSiteSettings>>;
      })
      .then((data) => {
        if (cancelled) return;
        setSettings((previous) => ({ ...previous, ...data }));
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const value = useMemo<SiteSettingsContextValue>(() => ({
    settings,
    dateSettings: {
      timezone: settings.site_timezone || "Asia/Shanghai",
      datePrecision: normalizeDatePrecision(settings.date_precision),
    },
    ready,
  }), [ready, settings]);

  // 公共设置就绪后应用全站主题（控制台「主题外观」的站点级设置：明暗 × 设计语言）。
  // ready 前不动作：保持 index.html 内联脚本按 cookie 设置的初始主题，避免默认暗色闪变。
  useEffect(() => {
    if (!ready) return;
    applySiteTheme(
      normalizeSiteThemeMode(settings.site_theme_mode),
      normalizeTheme(settings.site_theme_design),
    );
  }, [ready, settings.site_theme_mode, settings.site_theme_design]);

  // system 模式下跟随系统明暗变化
  useEffect(() => {
    if (!ready) return;
    if (normalizeSiteThemeMode(settings.site_theme_mode) !== "system") return;
    const design = normalizeTheme(settings.site_theme_design);
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applySiteTheme("system", design);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [ready, settings.site_theme_mode, settings.site_theme_design]);

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings(): SiteSettingsContextValue {
  const context = useContext(SiteSettingsContext);
  if (!context) throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  return context;
}
