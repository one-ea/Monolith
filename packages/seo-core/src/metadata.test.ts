import { describe, expect, it } from "vitest";
import { buildPageDocument } from "./document";
import { renderSeoHead, renderTitle, resolveOgImage } from "./metadata";
import type { SiteContext } from "./types";

const site: SiteContext = {
  origin: "https://example.com",
  title: "测试站",
  description: "站点描述",
  author: { name: "作者" },
  ogImageDefault: "/site-og.png",
  locale: "zh-CN",
};

const articleDoc = buildPageDocument({
  path: "/posts/a",
  title: '文章 "标题"',
  type: "article",
  description: "页面描述",
  contentMarkdown: "# a",
  coverImage: "/cover.png",
  publishedAt: "2026-01-01T00:00:00Z",
  modifiedAt: "2026-02-01T00:00:00Z",
  tags: ["x", "y"],
  site,
});

describe("resolveOgImage", () => {
  it("封面优先，回退站点默认图，再回退 og-default.png", () => {
    expect(resolveOgImage(articleDoc)).toBe("https://example.com/cover.png");
    expect(resolveOgImage({ ...articleDoc, coverImage: null })).toBe("https://example.com/site-og.png");
    expect(resolveOgImage({ ...articleDoc, coverImage: null, site: { ...site, ogImageDefault: "" } }))
      .toBe("https://example.com/og-default.png");
  });
});

describe("renderSeoHead", () => {
  const head = renderSeoHead(articleDoc);

  it("包含 title/description/canonical 与完整 OG/Twitter 集合", () => {
    expect(head).toContain(`<title>文章 &quot;标题&quot; | 测试站</title>`);
    expect(head).toContain(`<meta name="description" content="页面描述" />`);
    expect(head).toContain(`<link rel="canonical" href="https://example.com/posts/a" />`);
    expect(head).toContain(`og:image" content="https://example.com/cover.png"`);
    expect(head).toContain(`twitter:image"`);
    expect(head).toContain(`og:locale" content="zh_CN"`);
  });

  it("文章页带 article 时间与标签 meta，非文章页不带", () => {
    expect(head).toContain(`article:published_time" content="2026-01-01T00:00:00Z"`);
    expect(head).toContain(`article:tag" content="x"`);
    const homeHead = renderSeoHead(buildPageDocument({ path: "/", title: "", site }));
    expect(homeHead).not.toContain(`article:`);
  });

  it("og:image 尺寸：提供 ogImageSize 时输出 width/height，未提供时省略", () => {
    expect(renderSeoHead({ ...articleDoc, ogImageSize: { width: 1200, height: 630 } }))
      .toContain(`<meta property="og:image:width" content="1200" />`);
    expect(head).not.toContain(`og:image:width`);
  });

  it("属性值做 HTML 转义（引号/尖括号）", () => {
    expect(head).toContain(`content="文章 &quot;标题&quot;`);
  });

  it("noindex 输出 robots meta", () => {
    const head404 = renderSeoHead(buildPageDocument({ path: "/not-found", title: "404", noindex: true, site }));
    expect(head404).toContain(`<meta name="robots" content="noindex, nofollow" />`);
  });

  it("无标题页面渲染「站名 — 描述」", () => {
    expect(renderTitle(buildPageDocument({ path: "/", title: "", site }))).toBe("测试站 — 站点描述");
  });
});
