import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { checkAuth, login } from "@/lib/api";

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

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 密码框 */}
      <div className="fixed z-50 left-1/2 top-[30%] -translate-x-1/2 w-[320px] animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="rounded-xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-2xl p-[24px]">
          {checking ? (
            <div className="py-[16px] text-center text-[13px] text-muted-foreground/60">
              验证中...
            </div>
          ) : (
            <form onSubmit={handleSubmit} aria-label="管理员登录">
              <div className="mb-[16px] text-center">
                <div className="mx-auto mb-[10px] flex h-[36px] w-[36px] items-center justify-center rounded-lg bg-gradient-to-b from-foreground/8 to-foreground/4 border border-border/20">
                  <span className="text-[16px]">🔐</span>
                </div>
                <p className="text-[12px] text-muted-foreground/50">
                  管理员验证
                </p>
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
                className="h-[40px] w-full rounded-lg border border-border/40 bg-background/50 px-[14px] text-[14px] text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-foreground/25 focus:ring-1 focus:ring-foreground/10 transition-all"
              />

              {error && (
                <p className="mt-[8px] text-[12px] text-red-400/80 text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="mt-[12px] h-[36px] w-full rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {loading ? "验证中..." : "进入"}
              </button>

              <p className="mt-[12px] text-center text-[11px] text-muted-foreground/25">
                按 ESC 关闭
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
