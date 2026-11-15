import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { login, checkAuth, fetchPublicSettings } from "@/lib/api";

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
};

type TurnstileApi = {
  render: (el: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadTurnstileScript(boot: () => void, onError: () => void) {
  const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile-api]");
  const script = existing ?? document.createElement("script");
  if (!existing) {
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.turnstileApi = "true";
    document.head.appendChild(script);
  }
  script.addEventListener("load", boot, { once: true });
  script.addEventListener("error", onError, { once: true });
}

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const [turnstileSitekey, setTurnstileSitekey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [widgetError, setWidgetError] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.title = "管理登录 | Monolith";
    checkAuth().then((ok) => { if (ok) setLocation("/admin"); });
    fetchPublicSettings()
      .then((settings) => {
        if (settings.turnstile_enabled === "true" && settings.turnstile_sitekey) {
          setTurnstileSitekey(settings.turnstile_sitekey);
        }
      })
      .catch(() => {});
  }, [setLocation]);

  // 加载 Turnstile 脚本并渲染挑战组件，主题切换时重建以保持明暗一致
  useEffect(() => {
    if (!turnstileSitekey) return;
    let observer: MutationObserver | null = null;
    let cancelled = false;

    const siteTheme = (): "light" | "dark" =>
      document.documentElement.getAttribute("data-mode") === "light" ? "light" : "dark";

    const renderWidget = () => {
      if (cancelled || !widgetRef.current || !window.turnstile) return;
      if (widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      setTurnstileToken("");
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: turnstileSitekey,
        theme: siteTheme(),
        callback: (token) => setTurnstileToken(token),
        "error-callback": () => setTurnstileToken(""),
        "expired-callback": () => setTurnstileToken(""),
      });
    };

    const boot = () => {
      if (cancelled) return;
      renderWidget();
      observer = new MutationObserver(renderWidget);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    };

    if (window.turnstile) {
      boot();
    } else {
      loadTurnstileScript(boot, () => setWidgetError(true));
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [turnstileSitekey]);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("");
    if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current);
  }, []);

  const turnstileRequired = Boolean(turnstileSitekey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (turnstileRequired && !turnstileToken) {
      setError("请先完成人机验证");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(password, turnstileToken || undefined);
      setLocation("/admin");
    } catch (err) {
      const { code, message } = err as Error & { code?: string };
      if (code === "turnstile_required" || code === "turnstile_invalid") resetTurnstile();
      setError(message || "密码错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-[16px] py-[64px] sm:py-[80px]">
      <div className="w-full max-w-[280px] rounded-md border border-border/30 bg-background/35 p-[24px] sm:max-w-[360px] sm:p-[32px]">
        <div className="mb-[24px] text-center">
          <img src="/monolith-logo.svg" alt="" aria-hidden="true" className="mx-auto mb-[16px] h-[48px] w-[48px] object-contain" />
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]">管理后台</h1>
          <p className="mt-[8px] text-[13px] text-muted-foreground">输入密码以进入管理界面</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]" aria-label="管理员登录">
          {/* 隐藏 username 字段：让 Bitwarden / 1Password / Chrome 等密码管理器识别为登录表单 */}
          <input
            type="text"
            name="username"
            value="admin"
            autoComplete="username"
            readOnly
            hidden
            tabIndex={-1}
            aria-hidden="true"
          />
          <input
            id="admin-login-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="管理密码"
            autoComplete="current-password"
            aria-label="管理员密码"
            autoFocus
            className="h-[44px] w-full min-w-0 rounded-md border border-border/60 bg-background/50 px-[12px] pr-[48px] text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/30"
          />
          {turnstileRequired && (
            <div className="mx-[-8px] flex min-h-[65px] items-center justify-center" aria-label="人机验证">
              <div ref={widgetRef} />
            </div>
          )}
          {turnstileRequired && widgetError && (
            <p className="text-[12px] text-muted-foreground">人机验证组件加载失败，请检查网络后刷新重试。</p>
          )}
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password || (turnstileRequired && !turnstileToken)}
            className="h-[44px] w-full rounded-md bg-foreground text-[14px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
