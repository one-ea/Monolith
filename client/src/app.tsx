import { Route, Switch, useLocation } from "wouter";
import { useEffect, Suspense, lazy } from "react";
import DOMPurify from "dompurify";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SearchOverlay } from "@/components/search";
import { ProtectedRoute } from "@/components/protected-route";
import { AdminLayout } from "@/components/admin-layout";
import { CookieConsent, getCookieConsent } from "@/components/cookie-consent";
import { trackPageview, bindUnloadTracker } from "@/lib/analytics";
import { useSiteSettings } from "@/lib/site-settings";

// 代码分割 (Code Splitting)
const HomePage = lazy(() => import("@/pages/home").then((m) => ({ default: m.HomePage })));
const PostPage = lazy(() => import("@/pages/post").then((m) => ({ default: m.PostPage })));
const DocsPage = lazy(() => import("@/pages/docs").then((m) => ({ default: m.DocsPage })));
const ArchivePage = lazy(() => import("@/pages/archive").then((m) => ({ default: m.ArchivePage })));
const AboutPage = lazy(() => import("@/pages/about").then((m) => ({ default: m.AboutPage })));
const FriendsPage = lazy(() => import("@/pages/friends").then((m) => ({ default: m.FriendsPage })));
const GuestbookPage = lazy(() => import("@/pages/guestbook").then((m) => ({ default: m.GuestbookPage })));
const AdminLogin = lazy(() => import("@/pages/admin/login").then((m) => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard").then((m) => ({ default: m.AdminDashboard })));
const AdminEditor = lazy(() => import("@/pages/admin/editor").then((m) => ({ default: m.AdminEditor })));
const AdminSettings = lazy(() => import("@/pages/admin/settings").then((m) => ({ default: m.AdminSettings })));
const AdminBackup = lazy(() => import("@/pages/admin/backup").then((m) => ({ default: m.AdminBackup })));
const AdminPages = lazy(() => import("@/pages/admin/pages").then((m) => ({ default: m.AdminPages })));
const AdminComments = lazy(() => import("@/pages/admin/comments").then((m) => ({ default: m.AdminComments })));
const AdminFriends = lazy(() => import("@/pages/admin/friends").then((m) => ({ default: m.AdminFriends })));
const AdminGuestbook = lazy(() => import("@/pages/admin/guestbook").then((m) => ({ default: m.AdminGuestbook })));
const AdminMedia = lazy(() => import("@/pages/admin/media").then((m) => ({ default: m.AdminMedia })));
const AdminAnalytics = lazy(() => import("@/pages/admin/analytics").then((m) => ({ default: m.AdminAnalytics })));
const AdminSeo = lazy(() => import("@/pages/admin/seo").then((m) => ({ default: m.AdminSeo })));
const PrivacyPage = lazy(() => import("@/pages/privacy").then((m) => ({ default: m.PrivacyPage })));
const DynamicPage = lazy(() => import("@/pages/dynamic-page").then((m) => ({ default: m.DynamicPage })));
const NotFoundPage = lazy(() => import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage })));


const CUSTOM_INJECTION_SANITIZE_CONFIG = {
  ADD_TAGS: ["script"],
  ADD_ATTR: ["src", "async", "defer"],
  FORBID_TAGS: ["style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

function sanitizeCustomHtml(html: string) {
  return DOMPurify.sanitize(html, CUSTOM_INJECTION_SANITIZE_CONFIG);
}

/** 将设置中的 HTML/JS 代码安全注入到页面（仅允许外部脚本 src） */
function injectHtml(container: HTMLElement, html: string) {
  const temp = document.createElement("div");
  temp.innerHTML = sanitizeCustomHtml(html);
  Array.from(temp.childNodes).forEach((node) => {
    if (node instanceof HTMLScriptElement) {
      if (!node.src) return; // 禁止内联脚本，只允许带 src 的外部脚本
      const script = document.createElement("script");
      script.src = node.src;
      if (node.hasAttribute("async")) script.async = true;
      if (node.hasAttribute("defer")) script.defer = true;
      container.appendChild(script);
    } else {
      container.appendChild(node.cloneNode(true));
    }
  });
}

const EXTERNAL_RESOURCE_TAGS = new Set(["audio", "embed", "img", "link", "object", "script", "source", "track", "video"]);

function isExternalResourceUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return false;

  try {
    const url = new URL(trimmed, window.location.href);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function hasExternalResources(html: string) {
  const temp = document.createElement("div");
  temp.innerHTML = sanitizeCustomHtml(html);
  return Array.from(temp.querySelectorAll<HTMLElement>("*")).some((node) => {
    const tagName = node.tagName.toLowerCase();
    if (EXTERNAL_RESOURCE_TAGS.has(tagName)) {
      return ["src", "href", "poster", "data"].some((attribute) => {
        const value = node.getAttribute(attribute);
        return value ? isExternalResourceUrl(value) : false;
      });
    }

    const style = node.getAttribute("style");
    return Boolean(style && /url\(\s*["']?(?:https?:|\/\/)/i.test(style));
  });
}

function removeCustomInjection() {
  document.querySelectorAll("[data-monolith-custom-injection=\"true\"]").forEach((node) => node.remove());
}

function syncDocumentBrand(settings: { site_title?: string; site_description?: string; site_icon?: string }) {
  const siteTitle = settings.site_title?.trim();
  const description = settings.site_description?.trim();
  const icon = settings.site_icon?.trim();

  if (siteTitle && document.title.startsWith("Monolith")) {
    document.title = description ? `${siteTitle} — ${description}` : siteTitle;
  }

  if (icon) {
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = icon;
  }
}

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function App() {
  const [location] = useLocation();
  const { settings, ready: siteSettingsReady } = useSiteSettings();

  // 访客埋点：路由变化触发 pageview，页面卸载触发 duration 上报
  useEffect(() => {
    bindUnloadTracker();
    trackPageview(location);
  }, [location]);

  // 路由判断逻辑
  const isAdminRoot = matchesPathPrefix(location, "/admin");
  const isEditorPage = matchesPathPrefix(location, "/admin/editor");
  const isLoginPage = matchesPathPrefix(location, "/admin/login");
  const isAdminArea = isAdminRoot && !isEditorPage && !isLoginPage;
  const isPublicPage = !isAdminRoot;

  // 注入自定义 header/footer 代码（需 Cookie 同意后加载第三方脚本）
  useEffect(() => {
    removeCustomInjection();
    if (isAdminRoot || !siteSettingsReady) return undefined;

    let cancelled = false;
    let cleanupConsentListener: (() => void) | undefined;

    const s = settings;
    syncDocumentBrand(s);
    const hasExternalResource = [s.custom_header, s.custom_footer]
      .some((html) => Boolean(html && hasExternalResources(html)));

    const inject = () => {
      if (cancelled) return;
      removeCustomInjection();
      if (s.custom_header) {
        const container = document.createElement("div");
        container.id = "monolith-custom-header";
        injectHtml(container, s.custom_header);
        Array.from(container.childNodes).forEach((n) => {
          if (n instanceof HTMLElement) n.dataset.monolithCustomInjection = "true";
          document.head.appendChild(n);
        });
      }
      if (s.custom_footer) {
        const container = document.createElement("div");
        container.id = "monolith-custom-footer";
        container.dataset.monolithCustomInjection = "true";
        injectHtml(container, s.custom_footer);
        document.body.appendChild(container);
      }
    };

    // 无外部资源则直接注入；有则等 Cookie 同意，避免未同意时发起第三方请求
    if (!hasExternalResource) {
      inject();
    } else if (getCookieConsent()) {
      inject();
    } else {
      window.addEventListener("cookie-consent-accepted", inject, { once: true });
      cleanupConsentListener = () => window.removeEventListener("cookie-consent-accepted", inject);
    }
    return () => {
      cancelled = true;
      cleanupConsentListener?.();
      removeCustomInjection();
    };
  }, [isAdminRoot, settings, siteSettingsReady]);

  return (
    <>
      <SearchOverlay />

      {/* ======== 1. 公开前台展示区 ======== */}
      {isPublicPage && siteSettingsReady && (
        <>
          <Navbar />
          <main className="mx-auto w-full max-w-[1440px] px-[20px] lg:px-[40px] flex-1 flex flex-col">
            <Suspense fallback={<div className="p-8 flex justify-center text-zinc-500">Loading...</div>}>
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/docs/:seriesSlug/:slug?" component={DocsPage} />
                <Route path="/posts/:slug" component={PostPage} />
                <Route path="/archive" component={ArchivePage} />
                <Route path="/about" component={AboutPage} />
                <Route path="/friends" component={FriendsPage} />
                <Route path="/guestbook" component={GuestbookPage} />
                <Route path="/privacy" component={PrivacyPage} />
                <Route path="/page/:slug" component={DynamicPage} />
                <Route>
                  <NotFoundPage />
                </Route>
              </Switch>
            </Suspense>
          </main>
          <Footer />
          <CookieConsent />
        </>
      )}

      {isPublicPage && !siteSettingsReady && (
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-[20px] lg:px-[40px]">
          <div className="h-[180px] w-full max-w-[720px] animate-pulse rounded-md bg-card/20" aria-label="正在加载站点设置" />
        </main>
      )}

      {/* ======== 2. 后台全屏编辑器区 ======== */}
      {isEditorPage && (
        <ProtectedRoute>
          <main className="mx-auto w-full px-[16px] flex-1 flex flex-col">
            <Suspense fallback={<div className="p-8 flex justify-center text-zinc-500">Loading...</div>}>
              <Switch>
                <Route path="/admin/editor/:slug?">
                  <AdminEditor />
                </Route>
              </Switch>
            </Suspense>
          </main>
        </ProtectedRoute>
      )}

      {/* ======== 3. 后台登录页 (无外壳独立渲染) ======== */}
      {isLoginPage && (
        <main className="mx-auto w-full max-w-[1440px] px-[20px] lg:px-[40px] flex-1 flex flex-col">
           <Suspense fallback={<div className="p-8 flex justify-center text-zinc-500">Loading...</div>}>
            <Switch>
              <Route path="/admin/login" component={AdminLogin} />
            </Switch>
          </Suspense>
        </main>
      )}

      {/* ======== 4. 核心管理后台区 (Admin App Shell) ======== */}
      {isAdminArea && (
        <ProtectedRoute>
          <AdminLayout>
            <Suspense fallback={<div className="p-8 flex justify-center text-zinc-500">Loading...</div>}>
              <Switch>
                <Route path="/admin/settings"><AdminSettings /></Route>
                <Route path="/admin/backup"><AdminBackup /></Route>
                <Route path="/admin/pages"><AdminPages /></Route>
                <Route path="/admin/comments"><AdminComments /></Route>
                <Route path="/admin/friends"><AdminFriends /></Route>
                <Route path="/admin/guestbook"><AdminGuestbook /></Route>
                <Route path="/admin/media"><AdminMedia /></Route>
                <Route path="/admin/analytics"><AdminAnalytics /></Route>
                <Route path="/admin/seo"><AdminSeo /></Route>
                <Route path="/admin"><AdminDashboard /></Route>
                <Route><NotFoundPage /></Route>
              </Switch>
            </Suspense>
          </AdminLayout>
        </ProtectedRoute>
      )}
    </>
  );
}
