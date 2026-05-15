import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { clearToken } from "@/lib/api";
import {
  LayoutDashboard,
  StickyNote,
  MessageCircle,
  ImageIcon,
  BarChart3,
  HardDrive,
  Sparkles,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  Search,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_GROUPS = [
  {
    title: "内容管理",
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "控制台" },
      { href: "/admin/pages", icon: StickyNote, label: "独立页面" },
      { href: "/admin/comments", icon: MessageCircle, label: "评论审核" },
    ],
  },
  {
    title: "资源与数据",
    items: [
      { href: "/admin/media", icon: ImageIcon, label: "媒体库" },
      { href: "/admin/analytics", icon: BarChart3, label: "数据分析" },
      { href: "/admin/seo", icon: Sparkles, label: "SEO 优化" },
      { href: "/admin/backup", icon: HardDrive, label: "安全备份" },
    ],
  },
  {
    title: "系统配置",
    items: [
      { href: "/admin/settings", icon: Settings, label: "站点设置" },
    ],
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    clearToken();
    setLocation("/admin/login");
  };

  const currentTitle =
    NAV_GROUPS.flatMap((group) => group.items).find((item) =>
      item.href === "/admin" ? location === "/admin" : location.startsWith(item.href)
    )?.label || "管理后台";

  const filteredNavGroups = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) return NAV_GROUPS;

    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(query)
          || item.href.toLowerCase().includes(query)
          || group.title.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [navQuery]);

  const SidebarFooter = () => (
    <div className="space-y-[2px] border-t border-border/20 p-[12px]">
      <div className="flex min-h-[44px] items-center justify-between px-[12px] py-[8px]">
        <span className="text-[13px] font-medium text-muted-foreground/55">主题</span>
        <ThemeToggle />
      </div>
      <button
        onClick={handleLogout}
        className="flex min-h-[44px] w-full items-center gap-[10px] rounded-md px-[12px] py-[8px] text-[13px] font-medium text-red-500/70 transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <LogOut className="w-[14px] h-[14px]" />
        退出登录
      </button>
    </div>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/25 p-[16px]">
        <Link href="/admin" className="flex items-center gap-[10px] rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => setMobileMenuOpen(false)}>
          <div className="flex h-[34px] w-[24px] items-center justify-center rounded-[4px] bg-gradient-to-b from-foreground/90 to-foreground/35 text-[0] shadow-[0_12px_28px_oklch(0_0_0_/_20%)]">
            M
          </div>
          <div>
            <span className="block font-heading text-[17px] font-semibold tracking-[-0.02em]">Monolith</span>
            <span className="block text-[10px] text-muted-foreground/45">Admin Console</span>
          </div>
        </Link>
        <label className="mt-[14px] flex min-h-[44px] items-center gap-[8px] rounded-md border border-border/25 bg-background/45 px-[12px] text-[13px] text-foreground shadow-[0_8px_24px_oklch(0_0_0_/_10%)] transition-colors focus-within:border-foreground/25 focus-within:bg-background/65 focus-within:ring-1 focus-within:ring-foreground/10">
          <Search className="h-[15px] w-[15px] shrink-0 text-muted-foreground/70" />
          <span className="sr-only">快速定位模块</span>
          <input
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            placeholder="搜索模块"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/65"
          />
          {navQuery && (
            <button
              type="button"
              onClick={() => setNavQuery("")}
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="清空模块搜索"
            >
              <X className="h-[13px] w-[13px]" />
            </button>
          )}
        </label>
      </div>

      <nav className="flex-1 space-y-[18px] overflow-y-auto px-[12px] py-[16px]">
        {filteredNavGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-[6px] px-[12px] text-[10px] font-semibold tracking-normal text-muted-foreground/35">
              {group.title}
            </h3>
            <div className="space-y-[2px]">
              {group.items.map((item) => {
                const isActive = item.href === "/admin"
                  ? location === "/admin"
                  : location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setNavQuery("");
                    }}
                    className={`relative flex min-h-[40px] items-center gap-[10px] rounded-md px-[12px] py-[8px] text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-[36px] ${
                      isActive
                        ? "bg-foreground/92 text-background shadow-[0_10px_28px_oklch(0_0_0_/_18%)]"
                        : "text-muted-foreground/55 hover:bg-muted/35 hover:text-foreground/85"
                    }`}
                  >
                    {isActive && <span className="absolute left-[4px] top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full bg-cyan-300/80" />}
                    <item.icon className="w-[14px] h-[14px]" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {filteredNavGroups.length === 0 && (
          <div className="rounded-md border border-border/25 bg-background/35 px-[12px] py-[14px] text-[12px] leading-[1.6] text-muted-foreground/65">
            没有匹配的模块
          </div>
        )}
      </nav>

      <SidebarFooter />
    </div>
  );

  return (
    <div className="h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border/25 bg-background/70 backdrop-blur-xl md:flex">
        <SidebarContent />
      </aside>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            id="admin-mobile-navigation"
            role="dialog"
            aria-label="导航菜单"
            className="relative flex flex-col w-[260px] max-w-[80vw] h-full bg-background shadow-2xl animate-in slide-in-from-left"
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="min-h-screen overflow-y-auto md:ml-[248px]">
        <header className="sticky top-0 z-40 flex h-[56px] shrink-0 items-center justify-between border-b border-border/30 bg-background/82 px-[16px] backdrop-blur-md md:hidden">
          <div className="flex items-center gap-[8px] font-semibold text-[14px]">
            <div className="w-[24px] h-[24px] rounded bg-foreground text-background flex items-center justify-center text-[11px] font-bold">M</div>
            <span>Admin</span>
          </div>
          <div className="flex items-center gap-[4px]">
            <ThemeToggle />
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[44px] w-[44px] items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="查看站点"
            >
              <ExternalLink className="w-[16px] h-[16px]" />
            </a>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="打开导航菜单"
              aria-expanded={mobileMenuOpen}
              aria-controls="admin-mobile-navigation"
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>
          </div>
        </header>

        <div className="hidden h-[56px] items-center justify-between border-b border-border/20 bg-background/72 px-[24px] backdrop-blur-xl md:flex">
          <div className="flex items-center gap-[8px]">
            <span className="font-heading text-[13px] font-medium text-foreground/90">Monolith 管理后台</span>
            <span className="text-[12px] text-muted-foreground/25">/</span>
            <span className="font-heading text-[13px] font-semibold text-foreground/75">{currentTitle}</span>
          </div>
          <div className="flex items-center gap-[8px]">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[36px] items-center gap-[6px] rounded-md border border-border/25 bg-background/45 px-[10px] text-[12px] text-muted-foreground/70 transition-colors hover:bg-accent/35 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ExternalLink className="h-[13px] w-[13px]" />
              查看站点
            </a>
            <ThemeToggle />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
