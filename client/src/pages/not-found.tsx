import { Link, useLocation } from "wouter";
import { SeoHead } from "@/components/seo-head";
import { Home, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  const [, navigate] = useLocation();

  const handleBack = () => {
    // 有浏览历史则返回，否则兜底到首页
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[24px] py-[80px]">
      <SeoHead title="404 — 页面未找到" description="您访问的页面不存在，可能已被移除或链接有误。" noindex />

      {/* 404 数字 */}
      <div className="relative select-none">
        <span className="text-[120px] sm:text-[160px] font-black tracking-[-0.05em] text-foreground/5 leading-none">
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[2px] w-[80px] bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />
        </div>
      </div>

      {/* 提示文字 */}
      <div className="text-center space-y-[8px]">
        <img src="/monolith-logo.svg" alt="" aria-hidden="true" className="mx-auto mb-[16px] h-[32px] w-[32px] opacity-50" />
        <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-[-0.02em]">
          页面未找到
        </h1>
        <p className="text-[14px] text-muted-foreground max-w-[320px]">
          您访问的页面不存在，可能已被移除或链接有误。
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-[12px] mt-[8px]">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-[6px] h-[36px] px-[16px] rounded-md text-[13px] font-medium text-muted-foreground bg-accent/30 hover:bg-accent/50 transition-colors duration-200"
        >
          <ArrowLeft className="h-[14px] w-[14px]" />
          返回上页
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-[6px] h-[36px] px-[16px] rounded-md text-[13px] font-medium text-background bg-foreground hover:bg-foreground/90 transition-colors duration-200"
        >
          <Home className="h-[14px] w-[14px]" />
          回到首页
        </Link>
      </div>
    </div>
  );
}
