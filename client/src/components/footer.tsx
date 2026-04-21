import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AnimateIn } from "@/hooks/use-animate";
import { fetchNavPages, type NavPage } from "@/lib/api";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [footerText, setFooterText] = useState("");
  const [navPages, setNavPages] = useState<NavPage[]>([]);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => setFooterText(data.footer_text || ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNavPages().then(setNavPages);
  }, []);

  const displayText = footerText || `© ${currentYear} Monolith. 使用 Hono + Vite 构建，部署于 Cloudflare 边缘。`;

  return (
    <footer className="app-footer mt-auto border-t border-border/40">
      <AnimateIn animation="animate-fade-in" className="mx-auto flex max-w-[1440px] flex-col items-center gap-[12px] px-[20px] py-[28px] lg:px-[40px]">
        {navPages.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-x-[16px] gap-y-[4px]">
            {navPages.map((p) => (
              <Link
                key={p.slug}
                href={`/page/${p.slug}`}
                className="text-[13px] text-muted-foreground/60 transition-colors duration-200 hover:text-foreground"
              >
                {p.title}
              </Link>
            ))}
          </nav>
        )}
        <p className="text-[12px] text-muted-foreground/50">{displayText}</p>
      </AnimateIn>
    </footer>
  );
}