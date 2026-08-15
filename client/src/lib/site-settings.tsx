import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SiteDatePrecision = "date" | "datetime";

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
  site_timezone: string;
  date_precision: string;
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
  site_timezone: "Asia/Shanghai",
  date_precision: "date",
};

type SiteSettingsContextValue = {
  settings: PublicSiteSettings;
  dateSettings: SiteDateSettings;
  ready: boolean;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

function normalizeDatePrecision(value: string): SiteDatePrecision {
  return value === "datetime" ? "datetime" : "date";
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSiteSettings>(DEFAULT_SITE_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/public")
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
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
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

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings(): SiteSettingsContextValue {
  const context = useContext(SiteSettingsContext);
  if (!context) throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  return context;
}
