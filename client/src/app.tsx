import { Route, Switch, useLocation } from "wouter";
import { useEffect, Suspense, lazy } from "react";
import DOMPurify from "dompurify";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SearchOverlay } from "@/components/search";
import { ProtectedRoute } from "@/components/protected-route";
import { AdminLayout } from "@/components/admin-layout";
import { CookieConsent, getCookieConsent } from "@/components/cookie-consent";

// 代码分割 (Code Splitting)
const HomePage = lazy(() => import("@/pages/home").then((m) => ({ default: m.HomePage })));
const PostPage = lazy(() => import("@/pages/post").then((m) => ({ default: m.PostPage })));
const ArchivePage = lazy(() => import("@/pages/archive").then((m) => ({ default: m.ArchivePage })));
const AboutPage = lazy(() => import("@/pages/about").then((m) => ({ default: m.AboutPage })));
const AdminLogin = lazy(() => import("@/pages/admin/login").then((m) => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard").then((m) => ({ default: m.AdminDashboard })));
const AdminEditor = lazy(() => import("@/pages/admin/editor").then((m) => ({ default: m.AdminEditor })));
const AdminSettings = lazy(() => import("@/pages/admin/settings").then((m) => ({ default: m.AdminSettings })));
const AdminBackup = lazy(() => import("@/pages/admin/backup").then((m) => ({ default: m.AdminBackup })));
const AdminPages = lazy(() => import("@/pages/admin/pages").then((m) => ({ default: m.AdminPages })));
const AdminComments = lazy(() => import("@/pages/admin/comments").then((m) => ({ default: m.AdminComments })));
const AdminMedia = lazy(() => import("@/pages/admin/media").then((m) => ({ default: m.AdminMedia })));
const AdminAnalytics = lazy(() => import("@/pages/admin/analytics").then((m) => ({ default: m.AdminAnalytics })));
const AdminSeo = lazy(() => import("@/pages/admin/seo").then((m) => ({ default: m.AdminSeo })));
const PrivacyPage = lazy(() => import("@/pages/privacy").then((m) => ({ default: m.PrivacyPage })));
const DynamicPage = lazy(() => import("@/pages/dynamic-page").then((m) => ({ default: m.DynamicPage })));
const NotFoundPage = lazy(() => import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage })));


/** 将设置中的 HTML/JS 代码安全注入到页面（仅允许外部脚本 src） */
function injectHtml(container: HTMLElement, html: string) {
  const temp = document.createElement("div");
  temp.innerHTML = DOMPurify.sanitize(html, {
    ADD_TAGS: ["script"],
    ADD_ATTR: ["src", "async", "defer"],
    FORBID_TAGS: ["style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  });
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

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function App() {
  const [location] = useLocation();

  // 路由判断逻辑
  const isAdminRoot = matchesPathPrefix(location, "/admin");
  const isEditorPage = matchesPathPrefix(location, "/admin/editor");
  const isLoginPage = matchesPathPrefix(location, "/admin/login");
  const isAdminArea = isAdminRoot && !isEditorPage && !isLoginPage;
  const isPublicPage = !isAdminRoot;

  // 注入自定义 header/footer 代码（需 Cookie 同意后加载第三方脚本）
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((s) => {
        const hasThirdParty = (s.custom_header && /<script/i.test(s.custom_header))
          || (s.custom_footer && /<script/i.test(s.custom_footer));

        const inject = () => {
          if (s.custom_header) {
            const container = document.createElement("div");
            container.id = "monolith-custom-header";
            injectHtml(container, s.custom_header);
            Array.from(container.childNodes).forEach((n) => document.head.appendChild(n));
          }
          if (s.custom_footer) {
            const container = document.createElement("div");
            container.id = "monolith-custom-footer";
            injectHtml(container, s.custom_footer);
            document.body.appendChild(container);
          }
        };

        // 无第三方脚本则直接注入；有则等 Cookie 同意
        if (!hasThirdParty) {
          inject();
        } else if (getCookieConsent()) {
          inject();
        } else {
          window.addEventListener("cookie-consent-accepted", inject, { once: true });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <SearchOverlay />

      {/* ======== 1. 公开前台展示区 ======== */}
      {isPublicPage && (
        <>
          <Navbar />
          <main className="mx-auto w-full max-w-[1440px] px-[20px] lg:px-[40px] flex-1 flex flex-col">
            <Suspense fallback={<div className="p-8 flex justify-center text-zinc-500">Loading...</div>}>
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/posts/:slug" component={PostPage} />
                <Route path="/archive" component={ArchivePage} />
                <Route path="/about" component={AboutPage} />
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
