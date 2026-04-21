import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { clearToken } from "@/lib/api";
import {
  LayoutDashboard,
  StickyNote,
  MessageCircle,
  ImageIcon,
  BarChart3,
  HardDrive,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navGroups = [
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

  const SidebarFooter = () => (
    <div className="border-t border-border/40 p-[12px] space-y-[2px]">
      <div className="flex items-center justify-between px-[12px] py-[8px]">
        <span className="text-[13px] font-medium text-muted-foreground/60">主题</span>
        <ThemeToggle />
      </div>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-[10px] px-[12px] py-[8px] rounded-md text-[13px] font-medium text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground transition-colors"
      >
        <ExternalLink className="w-[14px] h-[14px]" />
        查看站点
      </a>
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-[10px] px-[12px] py-[8px] rounded-md text-[13px] font-medium text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-colors"
      >
        <LogOut className="w-[14px] h-[14px]" />
        退出登录
      </button>
    </div>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-[20px]">
        <Link href="/admin" className="flex items-center gap-[10px]" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-[32px] h-[32px] rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-[16px]">
            M
          </div>
          <span className="font-semibold text-[18px] tracking-[-0.02em]">Monolith</span>
        </Link>
      </div>

      <nav className="flex-1 px-[12px] space-y-[16px] overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title}>
            <h3 className="px-[12px] text-[10px] font-semibold text-muted-foreground/30 uppercase tracking-wider mb-[6px]">
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
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-[10px] px-[12px] py-[8px] rounded-md text-[13px] font-medium transition-colors ${
                      isActive
                        ? "bg-foreground text-background"
                        : "text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-[14px] h-[14px]" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <SidebarFooter />
    </div>
  );

  return (
    <div className="h-screen w-full bg-background">
      <aside className="hidden md:flex flex-col w-[240px] border-r border-border/40 bg-muted/[0.03] fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            role="dialog"
            aria-label="导航菜单"
            className="relative flex flex-col w-[260px] max-w-[80vw] h-full bg-background shadow-2xl animate-in slide-in-from-left"
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="md:ml-[240px] min-h-screen overflow-y-auto">
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-[16px] h-[52px] border-b border-border/40 bg-background/80 backdrop-blur-md shrink-0">
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
              className="p-[6px] text-muted-foreground/50 hover:text-foreground transition-colors"
              aria-label="查看站点"
            >
              <ExternalLink className="w-[16px] h-[16px]" />
            </a>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-[6px] text-muted-foreground/50 hover:text-foreground transition-colors"
              aria-label="打开导航菜单"
              aria-expanded={mobileMenuOpen}
              aria-controls="admin-mobile-navigation"
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}