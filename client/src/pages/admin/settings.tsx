import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { getToken } from "@/lib/api";
import { applySiteTheme, normalizeTheme, normalizeSiteThemeMode, type SiteThemeMode, type Theme } from "@/lib/site-theme";
import {
  parseCustomSnippets,
  serializeCustomSnippets,
  legacyToSnippets,
  SNIPPET_PRESETS,
  type CustomSnippet,
} from "@/lib/custom-injection";
import { Save, Globe, User, Link2, ToggleLeft, ToggleRight, Code, Rss, Plus, Trash2, GripVertical, Home, Eye, Search, CheckCircle2, AlertTriangle, Clock3, Shield, Moon, Sun, Monitor, Palette, ChevronDown, ChevronRight, Bell, Send, Wand2, Apple, Smartphone, Shapes } from "lucide-react";

type Settings = {
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
  turnstile_enabled: string;
  turnstile_sitekey: string;
  site_theme_mode: string;
  site_theme_design: string;
  custom_snippets: string;
  site_origin: string;
  webhook_urls: string;
  indexnow_enabled: string;
  indexnow_key: string;
  resend_from: string;
  admin_email: string;
  cloudflare_account_id: string;
  jwt_session_days: string;
  login_rate_limit: string;
  login_rate_window_minutes: string;
  friendlink_rate_limit: string;
  friendlink_rate_window_hours: string;
  guestbook_rate_limit: string;
  guestbook_rate_window_hours: string;
};

const defaultSettings: Settings = {
  site_title: "Monolith",
  site_description: "书写代码、设计与边缘计算的个人博客",
  site_tagline: "在秩序与混沌的交界处，寻找属于自己的巨石碑。",
  hero_kicker: "EDGE JOURNAL / CODE ARCHIVE",
  hero_subtitle: "技术写作、系统设计与边缘实践的索引页",
  hero_description: "用更冷静的网格整理长期主题：前端架构、设计系统、边缘计算与工程排障。每一篇文章都尽量给出可复用的上下文，而不是只留下零散记录。",
  hero_actions: JSON.stringify([
    { label: "最新文章", href: "#latest-posts" },
    { label: "主题索引", href: "#content-index" },
    { label: "工程笔记", href: "/archive" },
  ]),
  hero_topics: JSON.stringify([
    { title: "系统设计", desc: "从边界、接口和运维成本切入" },
    { title: "阅读体验", desc: "让长文、代码与目录保持同一节奏" },
    { title: "边缘部署", desc: "Workers / D1 / R2 的真实工程路径" },
  ]),
  site_icon: "",
  site_og_image: "",
  author_name: "Monolith",
  author_title: "独立开发者",
  author_bio: "热爱于前端架构、设计系统与边缘计算。\n相信技术应当服务于人，而非反过来。",
  author_avatar: "",
  github_url: "",
  twitter_url: "",
  email: "",
  social_links: "",
  footer_text: "© 2026 Monolith. 使用 Hono + Vite 构建，部署于 Cloudflare 边缘。",
  rss_enabled: "true",
  custom_header: "",
  custom_footer: "",
  site_timezone: "Asia/Shanghai",
  date_precision: "date",
  turnstile_enabled: "false",
  turnstile_sitekey: "",
  site_theme_mode: "dark",
  site_theme_design: "classic",
  custom_snippets: "",
  site_origin: "",
  webhook_urls: "",
  indexnow_enabled: "true",
  indexnow_key: "",
  resend_from: "",
  admin_email: "",
  cloudflare_account_id: "",
  jwt_session_days: "7",
  login_rate_limit: "5",
  login_rate_window_minutes: "15",
  friendlink_rate_limit: "3",
  friendlink_rate_window_hours: "1",
  guestbook_rate_limit: "5",
  guestbook_rate_window_hours: "1",
};

type TabId = "identity" | "theme" | "home" | "profile" | "social" | "notify" | "security" | "advanced";
type TabDefinition = { id: TabId; label: string; icon: typeof Globe };

const TABS: TabDefinition[] = [
  { id: "identity", label: "站点身份", icon: Globe },
  { id: "theme", label: "主题外观", icon: Palette },
  { id: "home", label: "首页呈现", icon: Home },
  { id: "profile", label: "作者名片", icon: User },
  { id: "social", label: "社交与订阅", icon: Link2 },
  { id: "notify", label: "通知与集成", icon: Bell },
  { id: "security", label: "安全防护", icon: Shield },
  { id: "advanced", label: "发现与注入", icon: Code },
];

type HeroActionConfig = { id: string; label: string; href: string };
type HeroTopicConfig = { id: string; title: string; desc: string };

type SocialIcon = "github" | "x" | "mail" | "rss" | "link";

type SocialLinkConfig = {
  id: string;
  label: string;
  url: string;
  icon: SocialIcon;
  enabled: boolean;
};

const SOCIAL_ICON_OPTIONS: { value: SocialIcon; label: string }[] = [
  { value: "link", label: "链接" },
  { value: "github", label: "GitHub" },
  { value: "x", label: "X" },
  { value: "mail", label: "邮箱" },
  { value: "rss", label: "RSS" },
];

const THEME_MODE_OPTIONS: {
  id: SiteThemeMode;
  name: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "dark", name: "暗色", icon: Moon },
  { id: "light", name: "亮色", icon: Sun },
  { id: "system", name: "跟随系统", icon: Monitor },
];

const THEME_DESIGN_OPTIONS: {
  id: Theme;
  name: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "classic", name: "Classic Primer", desc: "GitHub Primer 基线 · 站点默认观感", icon: Shapes },
  { id: "apple", name: "Apple Theme", desc: "HIG · Liquid Glass 玻璃材质（接替原液态玻璃）", icon: Apple },
  { id: "pixel", name: "Pixel Theme", desc: "Material 3 Expressive · Container 层级 · 弹簧动效", icon: Smartphone },
];

function createSocialLink(link: Partial<SocialLinkConfig> = {}): SocialLinkConfig {
  return {
    id: link.id || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `social-${Date.now()}`),
    label: link.label || "",
    url: link.url || "",
    icon: link.icon || "link",
    enabled: link.enabled ?? true,
  };
}

function createStableId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}`;
}

// IndexNow 密钥规范：8-128 位 a-z A-Z 0-9 -，这里生成 32 位十六进制
function generateIndexNowKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isSocialIcon(value: unknown): value is SocialIcon {
  return typeof value === "string" && SOCIAL_ICON_OPTIONS.some((option) => option.value === value);
}

function parseSocialLinks(value: string): SocialLinkConfig[] | null {
  if (!value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => createSocialLink({
        id: typeof item.id === "string" ? item.id : undefined,
        label: typeof item.label === "string" ? item.label : "",
        url: typeof item.url === "string" ? item.url : "",
        icon: isSocialIcon(item.icon) ? item.icon : "link",
        enabled: typeof item.enabled === "boolean" ? item.enabled : true,
      }));
  } catch {
    return null;
  }
}

function getLegacySocialLinks(settings: Settings): SocialLinkConfig[] {
  const links: SocialLinkConfig[] = [];
  if (settings.github_url) links.push(createSocialLink({ id: "legacy-github", label: "GitHub", url: settings.github_url, icon: "github" }));
  if (settings.twitter_url) links.push(createSocialLink({ id: "legacy-x", label: "X", url: settings.twitter_url, icon: "x" }));
  if (settings.email) links.push(createSocialLink({ id: "legacy-email", label: "邮箱", url: settings.email, icon: "mail" }));
  return links;
}

function getSocialLinks(settings: Settings): SocialLinkConfig[] {
  if (!settings.social_links.trim()) return getLegacySocialLinks(settings);
  const parsed = parseSocialLinks(settings.social_links);
  return parsed === null ? getLegacySocialLinks(settings) : parsed;
}

function serializeSocialLinks(links: SocialLinkConfig[]) {
  return JSON.stringify(links.map((link) => ({
    id: link.id,
    label: link.label.trim(),
    url: link.url.trim(),
    icon: link.icon,
    enabled: link.enabled,
  })));
}

function toLegacySocialFields(links: SocialLinkConfig[]) {
  const enabledLinks = links.filter((link) => link.enabled);
  const github = enabledLinks.find((link) => link.icon === "github");
  const x = enabledLinks.find((link) => link.icon === "x");
  const email = enabledLinks.find((link) => link.icon === "mail");

  return {
    github_url: github?.url.trim() || "",
    twitter_url: x?.url.trim() || "",
    email: email?.url.trim().replace(/^mailto:/i, "") || "",
  };
}

function parseHeroActions(value: string): HeroActionConfig[] {
  if (!value.trim()) {
    return [
      { id: "hero-action-latest", label: "最新文章", href: "#latest-posts" },
      { id: "hero-action-index", label: "主题索引", href: "#content-index" },
      { id: "hero-action-archive", label: "工程笔记", href: "/archive" },
    ];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `hero-action-${index}`,
        label: typeof item.label === "string" ? item.label : "",
        href: typeof item.href === "string" ? item.href : "",
      }));
  } catch {
    return [];
  }
}

function serializeHeroActions(actions: HeroActionConfig[]) {
  return JSON.stringify(actions.map((item) => ({
    id: item.id,
    label: item.label.trim(),
    href: item.href.trim(),
  })));
}

function parseHeroTopics(value: string): HeroTopicConfig[] {
  if (!value.trim()) {
    return [
      { id: "hero-topic-system", title: "系统设计", desc: "从边界、接口和运维成本切入" },
      { id: "hero-topic-reading", title: "阅读体验", desc: "让长文、代码与目录保持同一节奏" },
      { id: "hero-topic-edge", title: "边缘部署", desc: "Workers / D1 / R2 的真实工程路径" },
    ];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `hero-topic-${index}`,
        title: typeof item.title === "string" ? item.title : "",
        desc: typeof item.desc === "string" ? item.desc : "",
      }));
  } catch {
    return [];
  }
}

function serializeHeroTopics(topics: HeroTopicConfig[]) {
  return JSON.stringify(topics.map((item) => ({
    id: item.id,
    title: item.title.trim(),
    desc: item.desc.trim(),
  })));
}

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" as "" | "success" | "error" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("identity");
  const [loadError, setLoadError] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [turnstileSecretOk, setTurnstileSecretOk] = useState<boolean | null>(null);
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<{ resendKeyConfigured: boolean; webhookConfigured: boolean; effectiveSiteOrigin: string } | null>(null);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookResults, setWebhookResults] = useState<{ url: string; status: number; ok: boolean }[] | null>(null);

  useEffect(() => {
    document.title = "站点配置 | Monolith";
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        throw new Error("设置加载失败");
      }
      const data = await res.json();
      if (data && Object.keys(data).length > 0) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
      setLoadError("");
    } catch {
      setSettings(defaultSettings);
      setLoadError("设置加载失败，请检查网络或稍后重试。");
    } finally {
      setLoading(false);
    }
    fetch("/api/admin/turnstile-status", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTurnstileSecretOk(data ? Boolean(data.secretConfigured) : null))
      .catch(() => setTurnstileSecretOk(null));
    fetch("/api/admin/integration-status", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setIntegrationStatus(data ?? null))
      .catch(() => setIntegrationStatus(null));
  };

  const testWebhook = async () => {
    setWebhookTesting(true);
    setWebhookResults(null);
    try {
      const res = await fetch("/api/admin/test-webhook", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "测试失败");
      setWebhookResults(data?.results ?? []);
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "测试失败", "error");
    } finally {
      setWebhookTesting(false);
    }
  };

  const showMsg = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const socialLinks = getSocialLinks(settings);
    const nextSettings = {
      ...settings,
      ...toLegacySocialFields(socialLinks),
      social_links: serializeSocialLinks(socialLinks),
    };
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(nextSettings),
      });
      if (!res.ok) throw new Error("保存失败");
      setSettings(nextSettings);
      showMsg("设置已保存", "success");
    } catch {
      showMsg("保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    setAvatarError(false);
  }, [settings.author_avatar]);

  const rssEnabled = settings.rss_enabled !== "false";
  const indexNowEnabled = settings.indexnow_enabled !== "false";
  const turnstileEnabled = settings.turnstile_enabled === "true";
  const themeMode = normalizeSiteThemeMode(settings.site_theme_mode);
  const themeDesign = normalizeTheme(settings.site_theme_design);
  const customSnippets = parseCustomSnippets(settings.custom_snippets);
  const socialLinks = getSocialLinks(settings);
  const heroActions = parseHeroActions(settings.hero_actions);
  const heroTopics = parseHeroTopics(settings.hero_topics);
  const hasLegacyInjection = customSnippets === null && Boolean(settings.custom_header.trim() || settings.custom_footer.trim());
  const legacyScriptInjected = /<script/i.test(settings.custom_header) || /<script/i.test(settings.custom_footer);
  const injectedSnippetCount = (customSnippets ?? []).filter((s) => s.enabled && s.code.trim()).length;
  const hasThirdPartyScript = customSnippets ? injectedSnippetCount > 0 : legacyScriptInjected;

  const updateSocialLinks = (links: SocialLinkConfig[]) => {
    setSettings((prev) => ({ ...prev, social_links: serializeSocialLinks(links) }));
  };

  const updateSocialLink = (id: string, patch: Partial<SocialLinkConfig>) => {
    updateSocialLinks(socialLinks.map((link) => link.id === id ? { ...link, ...patch } : link));
  };

  const addSocialLink = () => {
    updateSocialLinks([...socialLinks, createSocialLink({ label: "新链接", icon: "link" })]);
  };

  const removeSocialLink = (id: string) => {
    updateSocialLinks(socialLinks.filter((link) => link.id !== id));
  };

  const updateHeroActions = (actions: HeroActionConfig[]) => {
    setSettings((prev) => ({ ...prev, hero_actions: serializeHeroActions(actions) }));
  };

  const updateHeroAction = (id: string, patch: Partial<HeroActionConfig>) => {
    updateHeroActions(heroActions.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const addHeroAction = () => {
    updateHeroActions([...heroActions, { id: createStableId("hero-action"), label: "新入口", href: "/" }]);
  };

  const removeHeroAction = (id: string) => {
    updateHeroActions(heroActions.filter((item) => item.id !== id));
  };

  const updateHeroTopics = (topics: HeroTopicConfig[]) => {
    setSettings((prev) => ({ ...prev, hero_topics: serializeHeroTopics(topics) }));
  };

  const updateHeroTopic = (id: string, patch: Partial<HeroTopicConfig>) => {
    updateHeroTopics(heroTopics.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const addHeroTopic = () => {
    updateHeroTopics([...heroTopics, { id: createStableId("hero-topic"), title: "新主题", desc: "描述这个主题对读者的价值" }]);
  };

  const previewSiteTheme = (mode: SiteThemeMode, design: Theme) => {
    updateSetting("site_theme_mode", mode);
    updateSetting("site_theme_design", design);
    applySiteTheme(mode, design);
  };

  const updateSnippet = (id: string, patch: Partial<CustomSnippet>) => {
    setSettings((prev) => ({
      ...prev,
      custom_snippets: serializeCustomSnippets(
        (parseCustomSnippets(prev.custom_snippets) ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      ),
    }));
  };

  const addSnippetFromPreset = (preset: (typeof SNIPPET_PRESETS)[number]) => {
    const snippet: CustomSnippet = {
      id: createStableId("snippet"),
      name: preset.id === "blank" ? "新片段" : preset.name,
      position: preset.position,
      scope: "all",
      enabled: true,
      requireConsent: preset.requireConsent,
      code: preset.code,
    };
    setSettings((prev) => ({
      ...prev,
      custom_snippets: serializeCustomSnippets([...(parseCustomSnippets(prev.custom_snippets) ?? []), snippet]),
    }));
    setExpandedSnippetId(snippet.id);
  };

  const removeSnippet = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      custom_snippets: serializeCustomSnippets((parseCustomSnippets(prev.custom_snippets) ?? []).filter((s) => s.id !== id)),
    }));
  };

  const importLegacyInjection = () => {
    setSettings((prev) => ({
      ...prev,
      custom_snippets: serializeCustomSnippets(legacyToSnippets(prev.custom_header, prev.custom_footer)),
      custom_header: "",
      custom_footer: "",
    }));
  };

  const removeHeroTopic = (id: string) => {
    updateHeroTopics(heroTopics.filter((item) => item.id !== id));
  };

  if (loading) return <div className="py-[60px] text-center text-muted-foreground/40">加载中...</div>;

  return (
    <div className="mx-auto w-full max-w-[1120px] py-[24px] sm:py-[36px] px-[16px] sm:px-[20px]">
      {/* 顶栏 */}
      <div className="mb-[20px] flex flex-col gap-[16px] lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-[10px]">
            <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-[-0.02em]">站点配置</h1>
            <span className="rounded-md border border-border/25 px-[8px] py-[3px] font-mono text-[10px] text-muted-foreground/55">
              LIVE
            </span>
          </div>
          <p className="mt-[6px] max-w-[680px] text-[13px] leading-[1.65] text-muted-foreground/55">
            统一管理前台首屏、SEO 摘要、作者名片、订阅入口和第三方注入，避免配置项和真实站点表现脱节。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[12px]">
          {message.text && (
            <span className={`text-[12px] px-[12px] py-[6px] rounded-md animate-fade-in ${
              message.type === "success" ? "bg-foreground/8 text-foreground border border-border/30" : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {message.type === "success" ? "已保存 ✓" : "失败 ✕"}
            </span>
          )}
          <button onClick={handleSave} disabled={saving || !!loadError} className="inline-flex min-h-[44px] items-center gap-[6px] rounded-md bg-foreground px-[16px] text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50">
            <Save className="h-[14px] w-[14px]" />{saving ? "保存中..." : "保存更改"}
          </button>
        </div>
      </div>

      <div className="mb-[20px] grid grid-cols-1 gap-[12px] md:grid-cols-3">
        <ConfigStatusCard icon={Eye} label="前台首屏" value={settings.site_title || "未命名"} detail={settings.hero_description || settings.site_description || "尚未配置首页说明"} />
        <ConfigStatusCard icon={Search} label="SEO 摘要" value={`${settings.site_description.length}/160`} detail={settings.site_og_image ? "已配置分享图" : "建议补充社交分享图"} />
        <ConfigStatusCard icon={hasThirdPartyScript ? AlertTriangle : CheckCircle2} label="注入片段" value={customSnippets ? `${injectedSnippetCount}/${customSnippets.length} 启用` : hasThirdPartyScript ? "旧版已注入" : "未注入"} detail={hasThirdPartyScript ? "含外部资源的片段在访客同意后加载" : "当前无片段会向前台注入代码"} />
      </div>

      {loadError && (
        <div className="mb-[20px] rounded-lg border border-red-500/20 bg-red-500/10 px-[14px] py-[12px] text-[12px] text-red-400">
          <div className="flex items-center justify-between gap-[12px]">
            <span>{loadError}</span>
            <button onClick={fetchSettings} className="rounded-md border border-red-500/20 px-[10px] py-[4px] text-[11px] text-red-300 transition-colors hover:bg-red-500/10">
              重试
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-[24px] lg:gap-[36px]">
        {/* 左侧边栏导航 */}
        <div className="w-full md:w-[220px] shrink-0 flex md:flex-col gap-[4px] overflow-x-auto md:overflow-visible pb-[8px] md:pb-0 scrollbar-hide" role="tablist" aria-label="站点配置分类标签">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 w-auto md:w-full flex items-center gap-[10px] px-[14px] py-[10px] md:py-[12px] rounded-lg text-[13px] md:text-[14px] transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? "bg-card border border-border/15 text-foreground font-medium shadow-sm" 
                  : "text-muted-foreground/60 hover:text-foreground/85 hover:bg-card/40 border border-transparent"
              }`}
            >
              <tab.icon className={`h-[15px] w-[15px] ${activeTab === tab.id ? "text-foreground/82" : "opacity-60"}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 右侧面板主体内容 */}
        <div className="flex-1 min-w-0">
          
          {/* TAB: 站点身份 */}
          {activeTab === "identity" && (
            <div className="space-y-[20px] animate-fade-in" role="tabpanel" id="settings-panel-identity" aria-labelledby="settings-tab-identity">
              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">站点身份</h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">这些字段会影响首页标题、浏览器标题、Open Graph、RSS 和站点页脚。</p>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[16px]">
                  <SettingField label="站点标题" value={settings.site_title} onChange={(v) => updateSetting("site_title", v)} placeholder="Monolith" hint="用于首页 H1、SEO site_name 和 RSS 标题。" />
                  <SettingField label="站点域名 Origin" value={settings.site_origin} onChange={(v) => updateSetting("site_origin", v)} placeholder="https://example.com" mono hint={`sitemap、robots、RSS 绝对地址与邮件通知链接的基准域名；绑定自定义域名后改这里即可。留空回退部署变量（当前生效：${integrationStatus?.effectiveSiteOrigin || "请求域名"}）。`} />
                  <SettingField label="站点描述" value={settings.site_description} onChange={(v) => updateSetting("site_description", v)} placeholder="一句话描述你的博客（建议 80-160 字）" multiline hint={`${settings.site_description.length} 个字符，首页 Hero 未单独设置时也会使用它。`} />
                  <SettingField label="首页标语" value={settings.site_tagline} onChange={(v) => updateSetting("site_tagline", v)} placeholder="显示在首页首屏小标题区域" hint="作为首页副标题的回退值，适合写短句而不是长段落。" />
                  <SettingField label="站点图标 URL" value={settings.site_icon} onChange={(v) => updateSetting("site_icon", v)} placeholder="https://example.com/favicon.png" mono hint="用于浏览器 favicon 和左上角后台暗门入口，留空则使用默认图标。" />
                  <SettingField label="社交分享图 URL" value={settings.site_og_image} onChange={(v) => updateSetting("site_og_image", v)} placeholder="https://example.com/og-image.png" mono hint="用于首页 Open Graph / Twitter Card，留空则使用默认 og-default.png。" />
                  <SettingField label="页脚文本" value={settings.footer_text} onChange={(v) => updateSetting("footer_text", v)} placeholder="© 2026 ..." hint="显示在全站页脚，支持纯文本。" />
                  <div className="grid gap-[12px] sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-[6px] flex items-center gap-[6px] text-[11px] font-medium text-muted-foreground/50"><Clock3 className="h-[12px] w-[12px]" />站点时区</span>
                      <select value={settings.site_timezone} onChange={(e) => updateSetting("site_timezone", e.target.value)} className="settings-input h-[40px] w-full">
                        <option value="Asia/Shanghai">Asia/Shanghai（中国标准时间）</option>
                        <option value="UTC">UTC（协调世界时）</option>
                        <option value="Asia/Tokyo">Asia/Tokyo（日本标准时间）</option>
                        <option value="America/Los_Angeles">America/Los_Angeles（太平洋时间）</option>
                        <option value="America/New_York">America/New_York（东部时间）</option>
                        <option value="Europe/London">Europe/London（英国时间）</option>
                      </select>
                      <span className="mt-[6px] block text-[11px] leading-[1.5] text-muted-foreground/40">公开文章、评论和留言时间统一使用此 IANA 时区。</span>
                    </label>
                    <label className="block">
                      <span className="mb-[6px] flex items-center gap-[6px] text-[11px] font-medium text-muted-foreground/50">日期显示精度</span>
                      <select value={settings.date_precision} onChange={(e) => updateSetting("date_precision", e.target.value)} className="settings-input h-[40px] w-full">
                        <option value="date">仅日期</option>
                        <option value="datetime">日期 + 时分</option>
                        <option value="datetime_seconds">日期 + 时分秒</option>
                      </select>
                      <span className="mt-[6px] block text-[11px] leading-[1.5] text-muted-foreground/40">默认仅显示日期，适合保持当前首页与归档的密度。</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border/18 bg-background/24 p-[16px]">
                <div className="mb-[12px] flex items-center gap-[8px] text-[13px] font-medium text-foreground/80">
                  <Eye className="h-[14px] w-[14px]" />
                  公开呈现预览
                </div>
                <div className="rounded-md border border-border/18 bg-card/[0.10] p-[14px]">
                  <p className="font-mono text-[11px] text-muted-foreground/45">{settings.hero_kicker || defaultSettings.hero_kicker}</p>
                  <h3 className="mt-[8px] font-heading text-[34px] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[44px]">
                    {settings.site_title || "Monolith"}
                  </h3>
                  <p className="mt-[12px] max-w-[640px] text-[13px] leading-[1.7] text-muted-foreground/70">
                    {settings.hero_description || settings.site_description || defaultSettings.hero_description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: 主题外观 */}
          {activeTab === "theme" && (
            <div className="space-y-[20px] animate-fade-in" role="tabpanel" id="settings-panel-theme" aria-labelledby="settings-tab-theme">
              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">主题外观</h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">全站设计语言与明暗模式，对前台所有访客统一生效；前台不再提供主题切换入口。</p>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[20px]">
                  <div>
                    <label className="mb-[6px] block text-[11px] font-medium text-muted-foreground/45 uppercase tracking-normal">设计语言</label>
                    <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-3">
                      {THEME_DESIGN_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => previewSiteTheme(themeMode, option.id)}
                          aria-pressed={themeDesign === option.id}
                          className={`flex min-h-[44px] items-center gap-[10px] rounded-md border px-[12px] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                            themeDesign === option.id
                              ? "border-border bg-accent/40"
                              : "border-border/50 hover:bg-accent/20"
                          }`}
                        >
                          <option.icon className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium leading-tight text-foreground">{option.name}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{option.desc}</span>
                          </span>
                          {themeDesign === option.id && <CheckCircle2 className="h-[14px] w-[14px] shrink-0 text-foreground" />}
                        </button>
                      ))}
                    </div>
                    <p className="mt-[6px] text-[11px] leading-[1.55] text-muted-foreground/35">同一套组件与语义 Token，多套设计语言即时换肤；Liquid Glass 仅用于 Apple 主题的导航与浮层。</p>
                  </div>
                  <div>
                    <label className="mb-[6px] block text-[11px] font-medium text-muted-foreground/45 uppercase tracking-normal">明暗模式</label>
                    <div className="grid grid-cols-3 gap-[8px]">
                      {THEME_MODE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => previewSiteTheme(option.id, themeDesign)}
                          aria-pressed={themeMode === option.id}
                          className={`flex min-h-[44px] items-center justify-center gap-[6px] rounded-md border px-[8px] text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                            themeMode === option.id
                              ? "border-border bg-accent/40 text-foreground"
                              : "border-border/50 text-muted-foreground hover:bg-accent/20"
                          }`}
                        >
                          <option.icon className="h-[14px] w-[14px]" />
                          {option.name}
                        </button>
                      ))}
                    </div>
                    <p className="mt-[6px] text-[11px] leading-[1.55] text-muted-foreground/35">选择「跟随系统」时，按每位访客设备的系统偏好自动切换明暗。</p>
                  </div>
                  <p className="text-[11px] leading-[1.55] text-muted-foreground/35">点击即在本页即时预览；保存后对全站生效，未保存的改动刷新后会还原。</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: 首页呈现 */}
          {activeTab === "home" && (
            <div className="space-y-[20px] animate-fade-in" role="tabpanel" id="settings-panel-home" aria-labelledby="settings-tab-home">
              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">首页呈现</h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">这里直接驱动首页首屏，不再让 Hero 文案散落在代码里。</p>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[16px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
                    <SettingField label="首屏眉标" value={settings.hero_kicker} onChange={(v) => updateSetting("hero_kicker", v)} placeholder="EDGE JOURNAL / CODE ARCHIVE" mono />
                    <SettingField label="首屏副标题" value={settings.hero_subtitle} onChange={(v) => updateSetting("hero_subtitle", v)} placeholder="技术写作、系统设计与边缘实践的索引页" />
                  </div>
                  <SettingField label="首屏说明" value={settings.hero_description} onChange={(v) => updateSetting("hero_description", v)} placeholder="用一段话说明这个站点值得读者停留的原因" multiline hint="为空时回退到站点描述。" />
                </div>
              </div>

              <EditableListSection
                title="首屏入口按钮"
                detail="最多展示前三个，适合放最新文章、主题索引、归档或重点页面。"
                actionLabel="添加入口"
                onAdd={addHeroAction}
              >
                {heroActions.map((item) => (
                  <div key={item.id} className="grid gap-[10px] rounded-md border border-border/16 bg-background/25 p-[12px] md:grid-cols-[minmax(120px,0.8fr)_minmax(160px,1fr)_44px] md:items-center">
                    <input value={item.label} onChange={(e) => updateHeroAction(item.id, { label: e.target.value })} placeholder="入口名称" className="settings-input h-[40px]" />
                    <input value={item.href} onChange={(e) => updateHeroAction(item.id, { href: e.target.value })} placeholder="/archive 或 #latest-posts" className="settings-input h-[40px] font-mono text-[12px]" />
                    <button type="button" onClick={() => removeHeroAction(item.id)} aria-label={`删除 ${item.label || "入口"}`} className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border/15 bg-background/25 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <Trash2 className="h-[15px] w-[15px]" />
                    </button>
                  </div>
                ))}
              </EditableListSection>

              <EditableListSection
                title="当前主题线索"
                detail="显示在首页右侧 CURRENT THREADS，用来解释站点当前主要写作方向。"
                actionLabel="添加主题"
                onAdd={addHeroTopic}
              >
                {heroTopics.map((item) => (
                  <div key={item.id} className="grid gap-[10px] rounded-md border border-border/16 bg-background/25 p-[12px] lg:grid-cols-[minmax(120px,0.7fr)_minmax(180px,1.3fr)_44px] lg:items-center">
                    <input value={item.title} onChange={(e) => updateHeroTopic(item.id, { title: e.target.value })} placeholder="主题标题" className="settings-input h-[40px]" />
                    <input value={item.desc} onChange={(e) => updateHeroTopic(item.id, { desc: e.target.value })} placeholder="一句话解释主题价值" className="settings-input h-[40px]" />
                    <button type="button" onClick={() => removeHeroTopic(item.id)} aria-label={`删除 ${item.title || "主题"}`} className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border/15 bg-background/25 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <Trash2 className="h-[15px] w-[15px]" />
                    </button>
                  </div>
                ))}
              </EditableListSection>
            </div>
          )}

          {/* TAB: 个人资料 */}
          {activeTab === "profile" && (
            <div className="space-y-[24px] animate-fade-in" role="tabpanel" id="settings-panel-profile" aria-labelledby="settings-tab-profile">
              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">个人资料</h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">维护博主名片栏目，向访客展示个人特写。</p>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[18px]">
                  <div>
                    <label className="mb-[6px] block text-[11px] font-medium text-muted-foreground/40 uppercase tracking-normal">头像</label>
                    <div className="flex items-start sm:items-center gap-[16px] flex-col sm:flex-row">
                      <div className="relative shrink-0">
                        {settings.author_avatar && !avatarError ? (
                          <img
                            src={settings.author_avatar}
                            alt="头像预览"
                            className="h-[64px] w-[64px] rounded-full object-cover border-[3px] border-card shadow-sm"
                            onError={() => setAvatarError(true)}
                          />
                        ) : (
                          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-[3px] border-card bg-foreground/[0.06] text-[24px] font-bold text-foreground/72 shadow-sm">
                            {(settings.author_name || 'M').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 w-full">
                        <input
                          value={settings.author_avatar}
                          onChange={(e) => updateSetting("author_avatar", e.target.value)}
                          placeholder="输入头像图片 URL，留空则显示简称"
                          className="settings-input h-[40px] font-mono"
                        />
                        <p className="text-[11px] text-muted-foreground/30 mt-[6px]">将图片上传至媒体资产后粘贴其 URL 地址。</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
                    <SettingField label="显示名称" value={settings.author_name} onChange={(v) => updateSetting("author_name", v)} placeholder="你的名字" />
                    <SettingField label="身份头衔" value={settings.author_title} onChange={(v) => updateSetting("author_title", v)} placeholder="例如：全栈工程师" />
                  </div>
                  <SettingField label="个人简介" value={settings.author_bio} onChange={(v) => updateSetting("author_bio", v)} placeholder="一段简短的自我介绍" multiline />
                </div>
              </div>
            </div>
          )}

          {/* TAB: 社交与订阅 */}
          {activeTab === "social" && (
            <div className="space-y-[24px] animate-fade-in" role="tabpanel" id="settings-panel-social" aria-labelledby="settings-tab-social">
              <div>
                <div className="mb-[16px] flex flex-col gap-[12px] sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-[16px] font-semibold mb-[4px]">友链与社交入口</h2>
                    <p className="text-[12px] text-muted-foreground/50">按需添加任意平台链接，启用后会展示在首页博主名片中。</p>
                  </div>
                  <button
                    type="button"
                    onClick={addSocialLink}
                    className="inline-flex min-h-[44px] items-center justify-center gap-[6px] rounded-lg border border-border/20 bg-background/40 px-[14px] text-[13px] font-medium text-foreground transition-all hover:-translate-y-[2px] hover:bg-accent/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Plus className="h-[14px] w-[14px]" />
                    添加链接
                  </button>
                </div>
                <div className="rounded-md border border-border/20 bg-card/5 p-[14px] sm:p-[20px]">
                  {socialLinks.length > 0 ? (
                    <div className="space-y-[10px]">
                      {socialLinks.map((link) => (
                        <div key={link.id} className="grid gap-[10px] rounded-lg border border-border/15 bg-background/25 p-[12px] lg:grid-cols-[28px_minmax(110px,0.85fr)_minmax(180px,1.4fr)_112px_44px_44px] lg:items-center">
                          <div className="hidden h-[28px] w-[28px] items-center justify-center rounded-md text-muted-foreground/25 lg:flex">
                            <GripVertical className="h-[14px] w-[14px]" />
                          </div>
                          <label className="block">
                            <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/40 lg:sr-only">名称</span>
                            <input
                              value={link.label}
                              onChange={(e) => updateSocialLink(link.id, { label: e.target.value })}
                              placeholder="平台名称"
                            className="settings-input h-[40px]"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/40 lg:sr-only">地址</span>
                            <input
                              value={link.url}
                              onChange={(e) => updateSocialLink(link.id, { url: e.target.value })}
                              placeholder={link.icon === "mail" ? "you@example.com" : "https://example.com"}
                              className="settings-input h-[40px] font-mono text-[12px]"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/40 lg:sr-only">图标</span>
                            <select
                              value={link.icon}
                              onChange={(e) => updateSocialLink(link.id, { icon: e.target.value as SocialIcon })}
                              className="settings-input h-[40px]"
                            >
                              {SOCIAL_ICON_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => updateSocialLink(link.id, { enabled: !link.enabled })}
                            aria-label={link.enabled ? `停用 ${link.label || "链接"}` : `启用 ${link.label || "链接"}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border/15 bg-background/25 text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            {link.enabled ? (
                              <ToggleRight className="h-[28px] w-[28px] text-foreground/75" />
                            ) : (
                              <ToggleLeft className="h-[28px] w-[28px] text-muted-foreground/30" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSocialLink(link.id)}
                            aria-label={`删除 ${link.label || "链接"}`}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border/15 bg-background/25 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <Trash2 className="h-[15px] w-[15px]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/20 px-[18px] py-[28px] text-center">
                      <p className="text-[13px] font-medium text-foreground/80">还没有配置链接</p>
                      <p className="mt-[6px] text-[12px] text-muted-foreground/45">添加 GitHub、邮箱、项目页或任意友链入口。</p>
                    </div>
                  )}
                  <div className="mt-[14px] flex items-center gap-[6px] text-[11px] text-muted-foreground/35">
                    <div className="h-[12px] w-[2px] rounded-full bg-foreground/36" />
                    旧版 GitHub、X、邮箱字段会自动迁移为列表项，保存后继续兼容旧接口。
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">RSS 订阅流</h2>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-foreground flex items-center gap-[6px]">
                        <Rss className="h-[14px] w-[14px] text-foreground/60" /> RSS Feed 源
                      </p>
                      <p className="text-[12px] text-muted-foreground/40 mt-[4px]">
                        {rssEnabled ? "开启状态，访客可订阅最新发布的文章" : "已隐藏，页脚不再展示订阅入口"}
                      </p>
                    </div>
                    <button onClick={() => updateSetting("rss_enabled", rssEnabled ? "false" : "true")}
                      className="inline-flex items-center transition-opacity hover:opacity-80"
                    >
                      {rssEnabled ? (
                        <ToggleRight className="h-[32px] w-[32px] text-foreground/75" />
                      ) : (
                        <ToggleLeft className="h-[32px] w-[32px] text-muted-foreground/20" />
                      )}
                    </button>
                  </div>
                  {rssEnabled && (
                    <div className="mt-[16px] rounded-lg border border-border/10 bg-background/20 px-[14px] py-[10px] flex justify-between items-center">
                      <span className="text-[12px] text-muted-foreground/50 font-mono tracking-tight">
                        {typeof window !== "undefined" ? window.location.origin : ""}/rss.xml
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: 通知与集成 */}
          {activeTab === "notify" && (
            <div className="space-y-[20px] animate-fade-in" role="tabpanel" id="settings-panel-notify" aria-labelledby="settings-tab-notify">
              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">Webhook 通知</h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">文章发布 / 更新 / 批量操作、友链申请、留言提交时向目标地址推送 JSON 事件。</p>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[14px]">
                  <SettingField label="Webhook 目标地址" value={settings.webhook_urls} onChange={(v) => updateSetting("webhook_urls", v)} placeholder={"https://hooks.example.com/primary\nhttps://hooks.example.com/backup"} multiline mono hint="每行一个（也支持逗号分隔）；留空回退部署变量 WEBHOOK_URLS，两者皆空则不推送。" />
                  <div className="flex flex-wrap items-center gap-[10px]">
                    <button type="button" onClick={testWebhook} disabled={webhookTesting} className="inline-flex min-h-[36px] items-center gap-[6px] rounded-md border border-border/25 bg-background/40 px-[12px] text-[12px] font-medium text-foreground transition-colors hover:bg-accent/45 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <Send className="h-[13px] w-[13px]" />
                      {webhookTesting ? "发送中..." : "发送测试请求"}
                    </button>
                    <span className="text-[11px] text-muted-foreground/35">测试读取已保存的目标地址，修改后请先保存。</span>
                  </div>
                  {webhookResults && (
                    <div className="rounded-md border border-border/14 bg-background/20 px-[12px] py-[10px] space-y-[6px]">
                      {webhookResults.map((item) => (
                        <div key={item.url} className="flex items-center justify-between gap-[12px] text-[12px]">
                          <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground/60">{item.url}</span>
                          <span className={`inline-flex shrink-0 items-center gap-[6px] font-mono ${item.ok ? "text-foreground/80" : "text-red-400"}`}>
                            {item.ok ? <CheckCircle2 className="h-[13px] w-[13px]" /> : <AlertTriangle className="h-[13px] w-[13px]" />}
                            {item.status > 0 ? `HTTP ${item.status}` : "连接失败"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">搜索引擎即时收录</h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">文章发布、更新或批量发布时，通过 IndexNow 协议主动通知 Bing、Yandex 等搜索引擎抓取最新 URL。</p>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[14px]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-foreground flex items-center gap-[6px]">
                        <Search className="h-[14px] w-[14px] text-foreground/60" /> IndexNow 推送
                      </p>
                      <p className="text-[12px] text-muted-foreground/40 mt-[4px]">
                        {indexNowEnabled ? "开启状态，已发布文章的变更会即时提交给搜索引擎" : "已关闭，搜索引擎仅靠自然抓取发现更新"}
                      </p>
                    </div>
                    <button onClick={() => updateSetting("indexnow_enabled", indexNowEnabled ? "false" : "true")}
                      className="inline-flex items-center transition-opacity hover:opacity-80"
                      aria-label={indexNowEnabled ? "关闭 IndexNow 推送" : "开启 IndexNow 推送"}
                    >
                      {indexNowEnabled ? (
                        <ToggleRight className="h-[32px] w-[32px] text-foreground/75" />
                      ) : (
                        <ToggleLeft className="h-[32px] w-[32px] text-muted-foreground/20" />
                      )}
                    </button>
                  </div>

                  {indexNowEnabled && (
                    <>
                      <SettingField label="IndexNow Key" value={settings.indexnow_key} onChange={(v) => updateSetting("indexnow_key", v)} placeholder="8-128 位字母 / 数字 / 连字符" mono hint="非机密信息，留空则不推送；密钥文件会自动托管在站点根目录供搜索引擎校验。" />
                      <div className="flex flex-wrap items-center gap-[10px]">
                        <button type="button" onClick={() => updateSetting("indexnow_key", generateIndexNowKey())} className="inline-flex min-h-[36px] items-center gap-[6px] rounded-md border border-border/25 bg-background/40 px-[12px] text-[12px] font-medium text-foreground transition-colors hover:bg-accent/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                          <Wand2 className="h-[13px] w-[13px]" />
                          生成随机密钥
                        </button>
                        <span className="text-[11px] text-muted-foreground/35">生成后需点击保存才会生效，保存前旧密钥继续使用。</span>
                      </div>
                      {settings.indexnow_key.trim() && (
                        <div className="rounded-lg border border-border/10 bg-background/20 px-[14px] py-[10px] flex justify-between items-center">
                          <span className="text-[12px] text-muted-foreground/50 font-mono tracking-tight truncate">
                            {integrationStatus?.effectiveSiteOrigin || (typeof window !== "undefined" ? window.location.origin : "")}/indexnow-key.txt
                          </span>
                        </div>
                      )}
                      <p className="text-[11px] leading-[1.55] text-muted-foreground/35">定时发布到期上线时暂不自动推送，可在编辑器重新保存以补推；站点域名（site_origin）留空时回退部署变量或当前请求域名。</p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">邮件通知（Resend）</h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">新评论、友链申请与审核结果通过 Resend 发送邮件提醒。</p>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[14px]">
                  <ConfigStatusCard
                    icon={integrationStatus?.resendKeyConfigured === false ? AlertTriangle : CheckCircle2}
                    label="RESEND_API_KEY"
                    value={integrationStatus === null ? "检测中" : integrationStatus.resendKeyConfigured ? "已配置" : "未配置"}
                    detail={integrationStatus?.resendKeyConfigured ? "Workers secret 就绪，填写收发件人即可发送。" : "在仓库根目录执行 npx wrangler secret put RESEND_API_KEY --name monolith-server 完成配置。"}
                  />
                  <SettingField label="发件人地址" value={settings.resend_from} onChange={(v) => updateSetting("resend_from", v)} placeholder="Monolith Bot <blog@example.com>" mono hint="回退部署变量 RESEND_FROM；须为 Resend 已验证域名的地址。" />
                  <SettingField label="管理员收件邮箱" value={settings.admin_email} onChange={(v) => updateSetting("admin_email", v)} placeholder="admin@example.com" mono hint="接收新评论与友链申请提醒；回退部署变量 ADMIN_EMAIL。" />
                  <SettingField label="Cloudflare Account ID（AE 查询）" value={settings.cloudflare_account_id} onChange={(v) => updateSetting("cloudflare_account_id", v)} placeholder="32 位账户 ID" mono hint="非敏感配置，可从 Cloudflare Dashboard 账户概览复制；留空回退 Workers 变量 CLOUDFLARE_ACCOUNT_ID。" />
                </div>
              </div>
            </div>
          )}

          {/* TAB: 安全防护 */}
          {activeTab === "security" && (
            <div className="space-y-[20px] animate-fade-in" role="tabpanel" id="settings-panel-security" aria-labelledby="settings-tab-security">
              <div>
                <h2 className="text-[16px] font-semibold mb-[4px]">登录防护</h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">在管理登录页启用 Cloudflare Turnstile 人机验证（五秒盾），拦截自动化密码爆破。</p>
                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[16px]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-medium text-foreground flex items-center gap-[6px]">
                        <Shield className="h-[14px] w-[14px] text-foreground/60" /> 登录页人机验证
                      </p>
                      <p className="text-[12px] text-muted-foreground/40 mt-[4px]">
                        {turnstileEnabled ? "开启状态，登录前必须通过 Cloudflare 挑战" : "已关闭，仅保留基础速率限制（每 IP 15 分钟 5 次）"}
                      </p>
                    </div>
                    <button onClick={() => updateSetting("turnstile_enabled", turnstileEnabled ? "false" : "true")}
                      className="inline-flex items-center transition-opacity hover:opacity-80"
                      aria-label={turnstileEnabled ? "关闭登录人机验证" : "开启登录人机验证"}
                    >
                      {turnstileEnabled ? (
                        <ToggleRight className="h-[32px] w-[32px] text-foreground/75" />
                      ) : (
                        <ToggleLeft className="h-[32px] w-[32px] text-muted-foreground/20" />
                      )}
                    </button>
                  </div>

                  {turnstileEnabled && (
                    <>
                      <SettingField
                        label="Turnstile Site Key"
                        value={settings.turnstile_sitekey}
                        onChange={(v) => updateSetting("turnstile_sitekey", v)}
                        placeholder="0x4AAAAAAA..."
                        mono
                        hint="在 Cloudflare Dashboard → Turnstile 创建站点后获取，属于公开密钥，可安全保存在站点设置中。"
                      />
                      <div className="grid gap-[12px] sm:grid-cols-2">
                        <ConfigStatusCard
                          icon={turnstileSecretOk === false ? AlertTriangle : CheckCircle2}
                          label="服务端密钥 TURNSTILE_SECRET"
                          value={turnstileSecretOk === null ? "检测中" : turnstileSecretOk ? "已配置" : "未配置"}
                          detail={turnstileSecretOk ? "Workers 已持有服务端校验密钥，令牌验证可用。" : "在仓库根目录执行 npx wrangler secret put TURNSTILE_SECRET --name monolith-server 完成配置。"}
                        />
                        <ConfigStatusCard
                          icon={settings.turnstile_sitekey.trim() ? CheckCircle2 : AlertTriangle}
                          label="Turnstile Site Key"
                          value={settings.turnstile_sitekey.trim() ? "已填写" : "未填写"}
                          detail={settings.turnstile_sitekey.trim() ? "保存后登录页将渲染人机验证组件。" : "缺少 Site Key 时人机验证不会生效。"}
                        />
                      </div>
                      {(!settings.turnstile_sitekey.trim() || turnstileSecretOk === false) && (
                        <div className="flex gap-[8px] rounded-md border border-amber-500/20 bg-amber-500/5 px-[12px] py-[10px] text-[11px] leading-[1.6] text-amber-400/80">
                          <AlertTriangle className="mt-[1px] h-[13px] w-[13px] shrink-0" />
                          <span>
                            开启前需完成两项配置：在 Cloudflare Dashboard → Turnstile 创建站点拿到 Site Key 与 Secret Key；Site Key 填写在上方输入框，Secret Key 通过
                            <code className="mx-[4px] rounded bg-amber-500/10 px-[4px] py-[1px] font-mono">npx wrangler secret put TURNSTILE_SECRET --name monolith-server</code>
                            写入 Workers。任一项缺失时，登录页不会强制人机验证。
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-md border border-border/20 bg-card/5 p-[16px] sm:p-[20px] space-y-[16px]">
                  <div>
                    <p className="text-[14px] font-medium text-foreground flex items-center gap-[6px]">
                      <Clock3 className="h-[14px] w-[14px] text-foreground/60" /> 会话与防护策略
                    </p>
                    <p className="text-[12px] text-muted-foreground/40 mt-[4px]">调整管理会话时长与公开接口速率限制，保存后约 15 秒生效。</p>
                  </div>
                  <label className="block">
                    <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/45">管理会话时长</span>
                    <select value={settings.jwt_session_days} onChange={(e) => updateSetting("jwt_session_days", e.target.value)} className="settings-input h-[40px] w-full">
                      <option value="1">1 天（高安全）</option>
                      <option value="7">7 天（默认）</option>
                      <option value="30">30 天（长会话）</option>
                    </select>
                    <span className="mt-[6px] block text-[11px] leading-[1.5] text-muted-foreground/40">重新登录后按新时长签发令牌，已签发的令牌不受影响。</span>
                  </label>
                  <div className="grid gap-[12px] sm:grid-cols-2">
                    <NumberSettingField label="登录失败上限" value={settings.login_rate_limit} onChange={(v) => updateSetting("login_rate_limit", v)} min={1} max={100} suffix="次" hint={`窗口 ${settings.login_rate_window_minutes} 分钟`} />
                    <NumberSettingField label="登录窗口时长" value={settings.login_rate_window_minutes} onChange={(v) => updateSetting("login_rate_window_minutes", v)} min={1} max={1440} suffix="分钟" hint="超过上限后锁定该 IP 的时长" />
                    <NumberSettingField label="友链申请上限" value={settings.friendlink_rate_limit} onChange={(v) => updateSetting("friendlink_rate_limit", v)} min={1} max={100} suffix="次" hint={`窗口 ${settings.friendlink_rate_window_hours} 小时`} />
                    <NumberSettingField label="友链申请窗口" value={settings.friendlink_rate_window_hours} onChange={(v) => updateSetting("friendlink_rate_window_hours", v)} min={1} max={720} suffix="小时" hint="默认 1 小时 3 次" />
                    <NumberSettingField label="留言板上限" value={settings.guestbook_rate_limit} onChange={(v) => updateSetting("guestbook_rate_limit", v)} min={1} max={100} suffix="次" hint={`窗口 ${settings.guestbook_rate_window_hours} 小时`} />
                    <NumberSettingField label="留言板窗口" value={settings.guestbook_rate_window_hours} onChange={(v) => updateSetting("guestbook_rate_window_hours", v)} min={1} max={720} suffix="小时" hint="默认 1 小时 5 次" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: 扩展与注入 */}
          {activeTab === "advanced" && (
            <div className="space-y-[20px] animate-fade-in" role="tabpanel" id="settings-panel-advanced" aria-labelledby="settings-tab-advanced">
              <div>
                <h2 className="text-[16px] font-semibold mb-[4px] flex items-center gap-[6px]">
                  危险操作区 <span className="text-[10px] px-[6px] py-[2px] rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">Expert</span>
                </h2>
                <p className="text-[12px] text-muted-foreground/50 mb-[16px]">以片段方式向站点注入统计、验证或自定义代码，可独立控制位置、作用域与同意策略。</p>
                <div className="mb-[16px] flex gap-[8px] rounded-md border border-amber-500/20 bg-amber-500/5 px-[12px] py-[10px] text-[11px] leading-[1.6] text-amber-400/80">
                  <AlertTriangle className="mt-[1px] h-[13px] w-[13px] shrink-0" />
                  <span>隐私与安全：片段会在访客浏览器中执行。仅允许带 src 的外部脚本（透传 data-* 属性）与 meta/link 等标签，内联脚本与 iframe 会被过滤；开启「需访客同意」的片段只在访客接受 Cookie 后加载。</span>
                </div>

                {hasLegacyInjection && (
                  <div className="mb-[16px] flex flex-col gap-[10px] rounded-md border border-border/20 bg-card/5 px-[14px] py-[12px] sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">检测到旧版注入代码</p>
                      <p className="mt-[4px] text-[12px] leading-[1.5] text-muted-foreground/45">可一键迁移为片段以获得独立开关与作用域控制；迁移并保存后旧字段会被清空。</p>
                    </div>
                    <button
                      type="button"
                      onClick={importLegacyInjection}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border border-border/25 bg-background/40 px-[14px] text-[13px] font-medium text-foreground transition-colors hover:bg-accent/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      导入为片段
                    </button>
                  </div>
                )}

                <section className="rounded-md border border-border/20 bg-card/5 p-[14px] sm:p-[20px]">
                  <div className="mb-[14px] flex flex-col gap-[12px]">
                    <div>
                      <h3 className="text-[14px] font-semibold text-foreground">注入片段</h3>
                      <p className="mt-[4px] text-[12px] text-muted-foreground/50">从模板快速创建，或添加空白片段自行编写；占位符 REPLACE_* 需替换为真实值。</p>
                    </div>
                    <div className="flex flex-wrap gap-[8px]">
                      {SNIPPET_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => addSnippetFromPreset(preset)}
                          title={preset.desc}
                          className="inline-flex min-h-[36px] items-center gap-[6px] rounded-md border border-border/25 bg-background/35 px-[12px] text-[12px] font-medium text-foreground transition-all hover:-translate-y-[2px] hover:bg-card/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <Plus className="h-[13px] w-[13px]" />
                          {preset.id === "blank" ? "空白片段" : preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-[10px]">
                    {(customSnippets ?? []).length > 0 ? (
                      (customSnippets ?? []).map((snippet) => (
                        <div key={snippet.id} className="rounded-lg border border-border/15 bg-background/25 p-[12px] space-y-[10px]">
                          <div className="grid gap-[10px] md:grid-cols-[minmax(150px,1fr)_132px_132px_44px_44px] md:items-center">
                            <label className="block">
                              <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/40 md:sr-only">名称</span>
                              <input
                                value={snippet.name}
                                onChange={(e) => updateSnippet(snippet.id, { name: e.target.value })}
                                placeholder="片段名称，如 Cloudflare 分析"
                                className="settings-input h-[40px]"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/40 md:sr-only">位置</span>
                              <select
                                value={snippet.position}
                                onChange={(e) => updateSnippet(snippet.id, { position: e.target.value as CustomSnippet["position"] })}
                                aria-label="注入位置"
                                className="settings-input h-[40px]"
                              >
                                <option value="head">&lt;head&gt; 内</option>
                                <option value="body-end">&lt;/body&gt; 前</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/40 md:sr-only">作用域</span>
                              <select
                                value={snippet.scope}
                                onChange={(e) => updateSnippet(snippet.id, { scope: e.target.value as CustomSnippet["scope"] })}
                                aria-label="作用域"
                                className="settings-input h-[40px]"
                              >
                                <option value="all">全站</option>
                                <option value="home">仅首页</option>
                                <option value="post">仅文章页</option>
                                <option value="archive">仅归档</option>
                                <option value="path">指定路径</option>
                              </select>
                            </label>
                            <button
                              type="button"
                              onClick={() => updateSnippet(snippet.id, { enabled: !snippet.enabled })}
                              aria-label={snippet.enabled ? `停用 ${snippet.name || "片段"}` : `启用 ${snippet.name || "片段"}`}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border/15 bg-background/25 text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              {snippet.enabled ? (
                                <ToggleRight className="h-[28px] w-[28px] text-foreground/75" />
                              ) : (
                                <ToggleLeft className="h-[28px] w-[28px] text-muted-foreground/30" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSnippet(snippet.id)}
                              aria-label={`删除 ${snippet.name || "片段"}`}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border/15 bg-background/25 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              <Trash2 className="h-[15px] w-[15px]" />
                            </button>
                          </div>

                          {snippet.scope === "path" && (
                            <label className="block">
                              <span className="mb-[6px] block text-[11px] font-medium uppercase tracking-normal text-muted-foreground/40">路径前缀</span>
                              <input
                                value={snippet.pathPrefix ?? ""}
                                onChange={(e) => updateSnippet(snippet.id, { pathPrefix: e.target.value })}
                                placeholder="/friends 或 /docs"
                                className="settings-input h-[40px] font-mono text-[12px]"
                              />
                              <span className="mt-[6px] block text-[11px] leading-[1.5] text-muted-foreground/40">匹配该前缀下的所有路由，如 /docs 匹配 /docs/a/b。</span>
                            </label>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-[10px]">
                            <button
                              type="button"
                              onClick={() => updateSnippet(snippet.id, { requireConsent: !snippet.requireConsent })}
                              aria-pressed={snippet.requireConsent}
                              className="inline-flex min-h-[36px] items-center gap-[6px] rounded-md border border-border/15 bg-background/25 px-[10px] text-[12px] text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              {snippet.requireConsent ? (
                                <ToggleRight className="h-[20px] w-[20px] text-foreground/75" />
                              ) : (
                                <ToggleLeft className="h-[20px] w-[20px] text-muted-foreground/35" />
                              )}
                              需访客同意后加载
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedSnippetId(expandedSnippetId === snippet.id ? null : snippet.id)}
                              aria-expanded={expandedSnippetId === snippet.id}
                              className="inline-flex min-h-[36px] items-center gap-[4px] rounded-md px-[8px] text-[12px] text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              {expandedSnippetId === snippet.id ? (
                                <ChevronDown className="h-[14px] w-[14px]" />
                              ) : (
                                <ChevronRight className="h-[14px] w-[14px]" />
                              )}
                              代码
                            </button>
                          </div>

                          {expandedSnippetId === snippet.id && (
                            <div>
                              <textarea
                                value={snippet.code}
                                onChange={(e) => updateSnippet(snippet.id, { code: e.target.value })}
                                placeholder={'<script defer src="https://analytics.example/script.js" data-website-id="..."></script>'}
                                rows={6}
                                className="settings-input min-h-[140px] resize-y py-[12px] font-mono text-[12px] leading-[1.6]"
                              />
                              <p className="mt-[6px] text-[11px] leading-[1.55] text-muted-foreground/35">仅支持外部脚本（src、async、defer、data-*、crossorigin）与 meta/link 等标签；内联脚本、style、iframe、form 会被过滤。</p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/20 px-[18px] py-[28px] text-center">
                        <p className="text-[13px] font-medium text-foreground/80">还没有注入片段</p>
                        <p className="mt-[6px] text-[12px] text-muted-foreground/45">从上方模板创建统计、验证类片段，或添加空白片段。</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* 底部 */}        </div>
      </div>
    </div>
  );
}

function ConfigStatusCard({ icon: Icon, label, value, detail }: {
  icon: typeof Globe;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-border/20 bg-card/5 p-[14px]">
      <div className="flex items-center gap-[8px] text-[11px] font-medium uppercase tracking-normal text-muted-foreground/55">
        <Icon className="h-[13px] w-[13px]" />
        {label}
      </div>
      <div className="mt-[8px] truncate font-heading text-[18px] font-semibold tracking-[-0.02em] text-foreground/90">{value}</div>
      <p className="mt-[6px] line-clamp-2 text-[12px] leading-[1.55] text-muted-foreground/50">{detail}</p>
    </div>
  );
}

function EditableListSection({ title, detail, actionLabel, onAdd, children }: {
  title: string;
  detail: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border/20 bg-card/5 p-[14px] sm:p-[20px]">
      <div className="mb-[14px] flex flex-col gap-[12px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
          <p className="mt-[4px] text-[12px] text-muted-foreground/50">{detail}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-[44px] items-center justify-center gap-[6px] rounded-md border border-border/25 bg-background/35 px-[12px] text-[13px] font-medium text-foreground transition-all hover:-translate-y-[2px] hover:bg-card/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Plus className="h-[14px] w-[14px]" />
          {actionLabel}
        </button>
      </div>
      <div className="space-y-[10px]">{children}</div>
    </section>
  );
}

function SettingField({ label, value, onChange, placeholder, multiline, hint, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: string; mono?: boolean;
}) {
  const inputClass = `settings-input ${mono ? "font-mono text-[12px]" : ""}`;

  return (
    <div>
      <label className="mb-[6px] block text-[11px] font-medium text-muted-foreground/45 uppercase tracking-normal">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className={`${inputClass} py-[10px] resize-y leading-[1.6]`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputClass} h-[40px]`} />
      )}
      {hint ? <p className="mt-[6px] text-[11px] leading-[1.55] text-muted-foreground/35">{hint}</p> : null}
    </div>
  );
}

function NumberSettingField({ label, value, onChange, min, max, suffix, hint }: {
  label: string; value: string; onChange: (v: string) => void; min: number; max: number; suffix?: string; hint?: string;
}) {
  return (
    <div>
      <label className="mb-[6px] block text-[11px] font-medium text-muted-foreground/45 uppercase tracking-normal">{label}</label>
      <div className="relative">
        <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="settings-input h-[40px] pr-[46px] font-mono" />
        {suffix && <span className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/40">{suffix}</span>}
      </div>
      {hint ? <p className="mt-[6px] text-[11px] leading-[1.55] text-muted-foreground/35">{hint}</p> : null}
    </div>
  );
}
