import { useEffect, useState } from "react";
import { AnimateIn } from "@/hooks/use-animate";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => setFooterText(data.footer_text || ""))
      .catch(() => {});
  }, []);

  const displayText = footerText || `© ${currentYear} Monolith. 使用 Hono + Vite 构建，部署于 Cloudflare 边缘。`;

  return (
    <footer className="mt-auto border-t border-border/40">
      <AnimateIn animation="animate-fade-in" className="mx-auto flex max-w-[1440px] items-center justify-center px-[20px] py-[28px] lg:px-[40px]">
        <p className="text-[12px] text-muted-foreground/50">{displayText}</p>
      </AnimateIn>
    </footer>
  );
}
