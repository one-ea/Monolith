import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { login, checkAuth } from "@/lib/api";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "管理登录 | Monolith";
    checkAuth().then((ok) => { if (ok) setLocation("/admin"); });
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(password);
      setLocation("/admin");
    } catch {
      setError("密码错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center py-[80px]">
      <div className="w-full max-w-[360px] rounded-lg border border-border/40 bg-card/30 p-[32px]">
        <div className="mb-[24px] text-center">
          <div className="mx-auto mb-[16px] h-[40px] w-[20px] rounded-[3px] bg-gradient-to-b from-foreground/80 to-foreground/40" />
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
            className="h-[40px] rounded-md border border-border/60 bg-background/50 px-[12px] text-[14px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/30 transition-colors"
          />
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="h-[40px] rounded-md bg-foreground text-background text-[14px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
