import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { checkAuth, getToken } from "@/lib/api";
import { ArrowLeft, Save, Globe, User, Link2, Rss, ToggleLeft, ToggleRight } from "lucide-react";
import { Link } from "wouter";

type Settings = {
  site_title: string;
  site_description: string;
  site_tagline: string;
  author_name: string;
  author_title: string;
  author_bio: string;
  author_avatar: string;
  github_url: string;
  twitter_url: string;
  email: string;
  footer_text: string;
  rss_enabled: string;
};

const defaultSettings: Settings = {
  site_title: "Monolith",
  site_description: "书写代码、设计与边缘计算的个人博客",
  site_tagline: "在秩序与混沌的交界处，寻找属于自己的巨石碑。",
  author_name: "Monolith",
  author_title: "独立开发者",
  author_bio: "热爱于前端架构、设计系统与边缘计算。\n相信技术应当服务于人，而非反过来。",
  author_avatar: "",
  github_url: "",
  twitter_url: "",
  email: "",
  footer_text: "© 2026 Monolith. 使用 Hono + Vite 构建，部署于 Cloudflare 边缘。",
  rss_enabled: "true",
};

export function AdminSettings() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" as "" | "success" | "error" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "站点设置 | Monolith";
    checkAuth().then((ok) => {
      if (!ok) { setLocation("/admin/login"); return; }
      fetchSettings();
    });
  }, [setLocation]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data && Object.keys(data).length > 0) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch { /* 使用默认值 */ }
    setLoading(false);
  };

  const showMsg = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("保存失败");
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

  const rssEnabled = settings.rss_enabled !== "false";

  if (loading) return <div className="py-[60px] text-center text-muted-foreground/40">加载中...</div>;

  return (
    <div className="mx-auto w-full max-w-[720px] py-[32px]">
      {/* 顶栏 */}
      <div className="mb-[28px] flex items-center justify-between">
        <div className="flex items-center gap-[16px]">
          <Link href="/admin" className="inline-flex items-center gap-[5px] text-[13px] text-muted-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="h-[13px] w-[13px]" />返回
          </Link>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">站点设置</h1>
        </div>
        <div className="flex items-center gap-[8px]">
          {message.text && (
            <span className={`text-[12px] px-[10px] py-[3px] rounded-md animate-fade-in ${
              message.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`}>
              {message.type === "success" ? "✓" : "✕"} {message.text}
            </span>
          )}
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-[4px] h-[32px] px-[14px] rounded-md bg-foreground text-background text-[12px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Save className="h-[11px] w-[11px]" />{saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>

      {/* 站点信息 */}
      <section className="mb-[24px]">
        <SectionHeader icon={Globe} title="站点信息" />
        <div className="rounded-lg border border-border/25 bg-card/15 p-[20px] space-y-[14px]">
          <SettingField label="站点标题" value={settings.site_title} onChange={(v) => updateSetting("site_title", v)} placeholder="Monolith" />
          <SettingField label="站点描述" value={settings.site_description} onChange={(v) => updateSetting("site_description", v)} placeholder="一句话描述你的博客" />
          <SettingField label="首页标语" value={settings.site_tagline} onChange={(v) => updateSetting("site_tagline", v)} placeholder="显示在首页 Hero 区域" />
          <SettingField label="页脚文本" value={settings.footer_text} onChange={(v) => updateSetting("footer_text", v)} placeholder="© 2026 ..."  />
        </div>
      </section>

      {/* 作者信息 */}
      <section className="mb-[24px]">
        <SectionHeader icon={User} title="博主名片" />
        <div className="rounded-lg border border-border/25 bg-card/15 p-[20px] space-y-[14px]">
          {/* 头像预览 + URL 输入 */}
          <div>
            <label className="mb-[4px] block text-[11px] text-muted-foreground/40 uppercase tracking-wider">头像</label>
            <div className="flex items-center gap-[14px]">
              <div className="relative flex-shrink-0">
                {settings.author_avatar ? (
                  <img
                    src={settings.author_avatar}
                    alt="头像预览"
                    className="h-[56px] w-[56px] rounded-full object-cover border-2 border-border/30"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 text-[20px] font-semibold text-foreground border-2 border-border/30">
                    {(settings.author_name || 'M').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  value={settings.author_avatar}
                  onChange={(e) => updateSetting("author_avatar", e.target.value)}
                  placeholder="输入头像图片 URL，留空则显示名称首字母"
                  className="w-full rounded-md border border-border/25 bg-background/20 px-[12px] h-[34px] text-[13px] text-foreground placeholder:text-muted-foreground/20 outline-none focus:border-foreground/15 transition-colors"
                />
                <p className="text-[10px] text-muted-foreground/25 mt-[4px]">💡 支持任意图片链接，也可上传到媒体库后粘贴地址</p>
              </div>
            </div>
          </div>
          <SettingField label="显示名称" value={settings.author_name} onChange={(v) => updateSetting("author_name", v)} placeholder="你的名字" />
          <SettingField label="身份头衔" value={settings.author_title} onChange={(v) => updateSetting("author_title", v)} placeholder="独立开发者 / 全栈工程师 / ..." />
          <SettingField label="个人简介" value={settings.author_bio} onChange={(v) => updateSetting("author_bio", v)} placeholder="一段简短的自我介绍" multiline />
        </div>
      </section>

      {/* 社交链接 */}
      <section className="mb-[24px]">
        <SectionHeader icon={Link2} title="社交链接" />
        <div className="rounded-lg border border-border/25 bg-card/15 p-[20px] space-y-[14px]">
          <SettingField label="GitHub" value={settings.github_url} onChange={(v) => updateSetting("github_url", v)} placeholder="https://github.com/username" />
          <SettingField label="X / Twitter" value={settings.twitter_url} onChange={(v) => updateSetting("twitter_url", v)} placeholder="https://x.com/username" />
          <SettingField label="邮箱" value={settings.email} onChange={(v) => updateSetting("email", v)} placeholder="you@example.com" />
          <p className="text-[10px] text-muted-foreground/25 pt-[4px]">💡 填入链接后会显示在首页侧边栏的博主名片中。留空则不显示。</p>
        </div>
      </section>

      {/* RSS 设置 */}
      <section className="mb-[24px]">
        <SectionHeader icon={Rss} title="RSS 订阅" />
        <div className="rounded-lg border border-border/25 bg-card/15 p-[20px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] text-foreground">RSS Feed</p>
              <p className="text-[12px] text-muted-foreground/40 mt-[2px]">
                {rssEnabled ? "已开启 — " : "已关闭 — "}
                <span className="text-muted-foreground/25">
                  {rssEnabled ? "访问 /rss.xml 可获取标准 RSS 2.0 订阅源" : "RSS 链接将从页脚隐藏"}
                </span>
              </p>
            </div>
            <button onClick={() => updateSetting("rss_enabled", rssEnabled ? "false" : "true")}
              className="inline-flex items-center gap-[4px] transition-colors"
            >
              {rssEnabled ? (
                <ToggleRight className="h-[28px] w-[28px] text-emerald-400" />
              ) : (
                <ToggleLeft className="h-[28px] w-[28px] text-muted-foreground/30" />
              )}
            </button>
          </div>
          {rssEnabled && (
            <div className="mt-[12px] rounded-md bg-background/20 px-[12px] py-[8px]">
              <p className="text-[11px] text-muted-foreground/30 font-mono">
                {typeof window !== "undefined" ? window.location.origin : ""}/rss.xml
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 数据管理 */}
      <section>
        <SectionHeader icon={Globe} title="数据管理" />
        <div className="rounded-lg border border-border/25 bg-card/15 p-[20px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] text-foreground">导出所有文章</p>
              <p className="text-[12px] text-muted-foreground/40 mt-[2px]">以 JSON 格式下载所有文章数据</p>
            </div>
            <button onClick={async () => {
              const res = await fetch("/api/admin/posts", { headers: { Authorization: `Bearer ${getToken()}` } });
              const p = await res.json();
              const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `monolith-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
              URL.revokeObjectURL(url);
              showMsg("导出完成", "success");
            }} className="h-[32px] px-[14px] rounded-md border border-border/30 text-[12px] text-muted-foreground hover:text-foreground hover:border-border/50 transition-colors">
              导出 JSON
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-[8px] mb-[14px]">
      <Icon className="h-[15px] w-[15px] text-muted-foreground/40" />
      <h2 className="text-[14px] font-medium text-muted-foreground/60 uppercase tracking-[0.06em]">{title}</h2>
    </div>
  );
}

function SettingField({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const inputClass = "w-full rounded-md border border-border/25 bg-background/20 px-[12px] text-[13px] text-foreground placeholder:text-muted-foreground/20 outline-none focus:border-foreground/15 transition-colors";

  return (
    <div>
      <label className="mb-[4px] block text-[11px] text-muted-foreground/40 uppercase tracking-wider">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${inputClass} py-[8px] resize-none leading-[1.7]`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputClass} h-[34px]`} />
      )}
    </div>
  );
}
