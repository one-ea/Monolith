"use client";

import { Link, useLocation } from "wouter";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AdminGate } from "@/components/admin-gate";
import { SearchTrigger } from "@/components/search";
import { ThemeToggle } from "@/components/theme-toggle";
import { fetchNavPages, type NavPage } from "@/lib/api";

const fixedStart = [{ href: "/", label: "首页" }];
const fixedEnd = [
  { href: "/archive", label: "归档" },
  { href: "/about", label: "关于" },
];

export function Navbar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [navPages, setNavPages] = useState<NavPage[]>([]);

  useEffect(() => {
    fetchNavPages().then(setNavPages);
  }, []);

  const navLinks = useMemo(
    () => [
      ...fixedStart,
      ...navPages.map((p) => ({ href: `/page/${p.slug}`, label: p.title })),
      ...fixedEnd,
    ],
    [navPages],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setGateOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleLogoDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGateOpen(true);
  }, []);

  const isAdmin = location.startsWith("/admin");

  return (
    <>
      <header className="app-header sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-[56px] max-w-[1440px] items-center justify-between px-[20px] lg:px-[40px]">
          <Link
            href="/"
            className="group flex items-center gap-[10px] select-none animate-slide-in-left"
            onDoubleClick={handleLogoDoubleClick}
          >
            <div className="relative flex h-[32px] w-[20px] items-center justify-center">
              <div className="absolute inset-0 rounded-[3px] bg-gradient-to-b from-foreground/90 to-foreground/60 transition-all duration-500 group-hover:from-cyan-400 group-hover:to-blue-600 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]" />
            </div>
            <span className="text-[18px] font-semibold tracking-[-0.03em] text-foreground">
              Monolith
            </span>
          </Link>

          <nav className="hidden items-center gap-[8px] md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-[12px] py-[6px] text-[14px] transition-colors duration-200 ${
                  location === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
                {location === link.href && (
                  <span className="absolute bottom-0 left-[12px] right-[12px] h-[1.5px] bg-foreground rounded-full" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-[4px]">
            <SearchTrigger />
            <span className="w-[1px] h-[16px] bg-border/40 mx-[2px]" />
            <ThemeToggle />

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger className="md:hidden inline-flex items-center justify-center h-[36px] w-[36px] rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-200 ml-[4px]">
                <Menu className="h-[18px] w-[18px]" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-background/95 backdrop-blur-xl">
                <nav className="flex flex-col gap-[4px] pt-[40px]">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`rounded-md px-[16px] py-[12px] text-[15px] transition-colors duration-200 ${
                        location === link.href
                          ? "bg-accent text-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {!isAdmin && (
        <AdminGate open={gateOpen} onClose={() => setGateOpen(false)} />
      )}
    </>
  );
}