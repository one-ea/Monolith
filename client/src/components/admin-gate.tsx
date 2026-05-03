import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { checkAuth, login } from "@/lib/api";
import { ArrowRight, KeyRound, ShieldCheck, X } from "lucide-react";

/**
 * 管理后台暗门组件
 * 触发方式：双击 Logo / Ctrl+Shift+A
 * 已登录 → 直接跳转 /admin
 * 未登录 → 弹出内联密码框
 */
export function AdminGate({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // 打开时立即检查是否已登录
  useEffect(() => {
    if (!open) return;
    setChecking(true);
    setPassword("");
    setError("");

    checkAuth().then((ok) => {
      if (ok) {
        // 已登录，直接跳转
        onClose();
        setLocation("/admin");
      } else {
        setChecking(false);
        // 聚焦输入框
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    });
  }, [open, onClose, setLocation]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) return;

      setLoading(true);
      setError("");
      try {
        await login(password);
        onClose();
        setLocation("/admin");
      } catch {
        setError("密码错误");
        setPassword("");
        inputRef.current?.focus();
      } finally {
        setLoading(false);
      }
    },
    [password, onClose, setLocation]
  );

  // ESC 关闭，并将键盘焦点限制在弹窗内
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusableElements = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);

      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-50 bg-background/55 backdrop-blur-[10px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 密码框 */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-gate-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="overflow-hidden rounded-md border border-border/35 bg-card/95 shadow-[0_28px_90px_oklch(0_0_0_/_38%)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/20 px-[18px] py-[14px]">
            <div className="flex items-center gap-[10px]">
              <div className="flex h-[32px] w-[32px] items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <ShieldCheck className="h-[16px] w-[16px]" />
              </div>
              <div>
                <p id="admin-gate-title" className="text-[13px] font-semibold text-foreground">后台安全验证</p>
                <p className="text-[11px] text-muted-foreground/55">Monolith Admin Gate</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="关闭管理验证"
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>

          <div className="p-[22px]">
            {checking ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-[12px] text-center text-[13px] text-muted-foreground/65">
                <div className="h-[28px] w-[28px] rounded-full border-2 border-foreground/10 border-t-cyan-400 animate-spin" />
                正在检查登录状态
              </div>
            ) : (
              <form onSubmit={handleSubmit} aria-label="管理员登录">
                <div className="mb-[18px]">
                  <div className="mb-[12px] flex items-start gap-[12px]">
                    <div className="mt-[2px] flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border border-border/30 bg-background/45 text-foreground">
                      <KeyRound className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <h2 className="text-[18px] font-semibold leading-tight tracking-[-0.01em] text-foreground">进入管理后台</h2>
                      <p className="mt-[6px] text-[13px] leading-[1.7] text-muted-foreground/70">
                        输入本地或生产环境配置的管理密码，验证通过后进入内容控制台。
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-[6px] text-[10px] text-muted-foreground/50">
                    <span className="rounded-md border border-border/20 bg-background/25 px-[8px] py-[6px] text-center">内容</span>
                    <span className="rounded-md border border-border/20 bg-background/25 px-[8px] py-[6px] text-center">媒体</span>
                    <span className="rounded-md border border-border/20 bg-background/25 px-[8px] py-[6px] text-center">SEO</span>
                  </div>
                </div>

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
                  ref={inputRef}
                  id="admin-gate-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="输入密码"
                  autoComplete="current-password"
                  aria-label="管理员密码"
                  className="h-[46px] w-full rounded-md border border-border/45 bg-background/55 px-[14px] pr-[48px] text-[15px] text-foreground outline-none transition-all placeholder:text-muted-foreground/35 focus:border-cyan-400/45 focus:ring-1 focus:ring-cyan-400/20"
                />

                {error && (
                  <p className="mt-[10px] rounded-md border border-red-400/20 bg-red-400/8 px-[10px] py-[8px] text-center text-[12px] text-red-400/90">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !password.trim()}
                  className="mt-[14px] flex h-[46px] w-full items-center justify-center gap-[8px] rounded-md bg-foreground text-[14px] font-medium text-background transition-all hover:-translate-y-[2px] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:translate-y-0 disabled:opacity-40"
                >
                  {loading ? "验证中..." : "进入控制台"}
                  {!loading && <ArrowRight className="h-[15px] w-[15px]" />}
                </button>

                <p className="mt-[14px] text-center text-[11px] text-muted-foreground/35">
                  ESC 关闭 · Ctrl Shift A 呼出
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
