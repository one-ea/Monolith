import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, Link2, Send, Sparkles } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { applyFriendLink, fetchFriends, type FriendLink } from "@/lib/api";

type FormState = {
  name: string;
  url: string;
  description: string;
  avatarUrl: string;
  ownerName: string;
  ownerEmail: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  url: "",
  description: "",
  avatarUrl: "",
  ownerName: "",
  ownerEmail: "",
};

const inputClass = "h-[42px] w-full rounded-md border border-border/25 bg-background/35 px-[12px] text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/35 focus:border-foreground/25";

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "L";
}

export function FriendsPage() {
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = "友链 | Monolith";
    fetchFriends()
      .then(setLinks)
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, []);

  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN")),
    [links],
  );

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!form.name.trim() || !form.url.trim() || !form.description.trim()) {
      setMessage({ type: "error", text: "请填写站点名称、网址和简介" });
      return;
    }

    setSubmitting(true);
    try {
      await applyFriendLink(form);
      setForm(EMPTY_FORM);
      setMessage({ type: "success", text: "申请已提交，审核通过后会展示在这里" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "提交失败" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] px-[16px] py-[32px] lg:px-0 lg:py-[56px]">
      <SeoHead
        title="友链"
        description="Monolith 的朋友站点与友链申请。"
        url="/friends"
      />

      <div className="mb-[28px]">
        <div className="mb-[10px] inline-flex items-center gap-[6px] rounded-md border border-border/25 bg-background/35 px-[10px] py-[6px] text-[12px] text-muted-foreground/70">
          <Sparkles className="h-[13px] w-[13px]" />
          Links
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-foreground">友链</h1>
        <p className="mt-[8px] max-w-[620px] text-[14px] leading-[1.8] text-muted-foreground/68">
          这里收纳一些长期关注、风格相近或彼此认识的站点。申请会先进入后台审核，避免无效链接和重复提交。
        </p>
      </div>

      <div className="grid gap-[24px] lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-[10px] flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-muted-foreground/60">已通过站点</h2>
            <span className="text-[12px] text-muted-foreground/35">{sortedLinks.length} 个</span>
          </div>

          {loading ? (
            <div className="grid gap-[10px] sm:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-[116px] animate-pulse rounded-md border border-border/20 bg-card/15" />
              ))}
            </div>
          ) : sortedLinks.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/25 px-[18px] py-[48px] text-center">
              <Link2 className="mx-auto mb-[10px] h-[22px] w-[22px] text-muted-foreground/24" />
              <p className="text-[13px] text-muted-foreground/55">暂时还没有展示中的友链</p>
            </div>
          ) : (
            <div className="grid gap-[10px] sm:grid-cols-2">
              {sortedLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-md border border-border/25 bg-card/10 p-[14px] transition-all duration-300 hover:-translate-y-[2px] hover:border-foreground/20 hover:bg-card/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div className="flex items-start gap-[12px]">
                    <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/20 bg-background/40 text-[15px] font-semibold text-muted-foreground/70">
                      {link.avatarUrl ? (
                        <img src={link.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        getInitial(link.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-[6px]">
                        <h3 className="truncate text-[14px] font-medium text-foreground">{link.name}</h3>
                        <ExternalLink className="h-[12px] w-[12px] shrink-0 text-muted-foreground/30 transition-colors group-hover:text-foreground/60" />
                      </div>
                      <p className="mt-[6px] line-clamp-2 min-h-[40px] text-[12px] leading-[1.7] text-muted-foreground/62">
                        {link.description || "这个站点还没有填写简介。"}
                      </p>
                      <p className="mt-[8px] truncate text-[11px] text-muted-foreground/32">{link.url}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-md border border-border/25 bg-card/10 p-[16px]">
          <h2 className="mb-[12px] text-[14px] font-medium text-foreground">申请友链</h2>
          <form className="space-y-[10px]" onSubmit={submit}>
            <input value={form.name} onChange={(e) => updateField("name", e.target.value)} className={inputClass} placeholder="站点名称" />
            <input value={form.url} onChange={(e) => updateField("url", e.target.value)} className={inputClass} placeholder="https://example.com" />
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
              className="w-full resize-y rounded-md border border-border/25 bg-background/35 px-[12px] py-[10px] text-[13px] leading-[1.7] text-foreground outline-none transition-colors placeholder:text-muted-foreground/35 focus:border-foreground/25"
              placeholder="一句话介绍你的站点"
            />
            <input value={form.avatarUrl} onChange={(e) => updateField("avatarUrl", e.target.value)} className={inputClass} placeholder="头像 URL，可选" />
            <div className="grid gap-[10px] sm:grid-cols-2 lg:grid-cols-1">
              <input value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} className={inputClass} placeholder="联系人，可选" />
              <input value={form.ownerEmail} onChange={(e) => updateField("ownerEmail", e.target.value)} className={inputClass} placeholder="邮箱，可选" />
            </div>
            {message && (
              <div className={`rounded-md border px-[12px] py-[10px] text-[12px] ${message.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-red-500/20 bg-red-500/10 text-red-500"}`}>
                {message.text}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-[42px] w-full items-center justify-center gap-[8px] rounded-md bg-foreground px-[14px] text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-[14px] w-[14px]" />
              {submitting ? "提交中..." : "提交申请"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
