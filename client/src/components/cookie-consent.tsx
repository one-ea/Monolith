import { useEffect, useState } from "react";

const CONSENT_KEY = "_gdpr_consent";
const CONSENT_EXPIRY_DAYS = 365;

function getConsent(): "accepted" | "rejected" | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() > data.expires) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }
    return data.value as "accepted" | "rejected";
  } catch {
    return null;
  }
}

function setConsent(value: "accepted" | "rejected") {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({
    value,
    expires: Date.now() + CONSENT_EXPIRY_DAYS * 86400000,
  }));
}

export function getCookieConsent(): boolean {
  return getConsent() === "accepted";
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-[12px] animate-fade-in">
      <div className="mx-auto flex max-w-[720px] flex-col items-start gap-[12px] rounded-md border border-border/30 bg-card/95 px-[20px] py-[16px] shadow-lg shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center">
        <div className="flex-1 text-[13px] text-muted-foreground/80 leading-[1.6]">
          本站使用 Cookie 进行访问统计与第三方脚本加载。继续访问即表示您同意我们的{" "}
          <a href="/privacy" className="text-foreground/70 underline underline-offset-2 hover:text-foreground transition-colors">隐私政策</a>。
        </div>
        <div className="flex shrink-0 gap-[8px]">
          <button
            onClick={() => { setConsent("rejected"); setVisible(false); }}
            className="min-h-[44px] rounded-md border border-border/30 px-[14px] py-[6px] text-[12px] text-muted-foreground/60 transition-all hover:border-border/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            拒绝
          </button>
          <button
            onClick={() => { setConsent("accepted"); window.dispatchEvent(new Event("cookie-consent-accepted")); setVisible(false); }}
            className="min-h-[44px] rounded-md bg-foreground px-[14px] py-[6px] text-[12px] font-medium text-background transition-all hover:bg-foreground/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            接受
          </button>
        </div>
      </div>
    </div>
  );
}
