import { describe, expect, it } from "vitest";
import { buildPageDocument, toAbsoluteUrl } from "./document";
import type { SiteContext } from "./types";

const site: SiteContext = {
  origin: "https://example.com",
  title: "测试站",
  description: "站点描述",
  author: { name: "作者" },
  locale: "zh-CN",
};

describe("toAbsoluteUrl", () => {
  it("相对路径拼 origin，非法协议返回空串", () => {
    expect(toAbsoluteUrl("/posts/a", "https://example.com")).toBe("https://example.com/posts/a");
    expect(toAbsoluteUrl("https://example.com/a", "https://example.com")).toBe("https://example.com/a");
    expect(toAbsoluteUrl("javascript:alert(1)", "https://example.com")).toBe("");
    expect(toAbsoluteUrl("", "https://example.com")).toBe("");
  });
});

describe("buildPageDocument", () => {
  it("从 Markdown 源构建 headings/links/images/contentText", () => {
    const doc = buildPageDocument({
      path: "/posts/hello",
      title: "你好",
      type: "article",
      contentMarkdown: "# 你上\n\n正文 [内链](/archive) 与 ![封面](/cover.png)\n\n## 小节",
      tags: ["edge"],
      site,
    });
    expect(doc.url).toBe("https://example.com/posts/hello");
    expect(doc.canonical).toBe(doc.url);
    expect(doc.headings.map((h) => h.text)).toEqual(["你上", "小节"]);
    expect(doc.links).toEqual([{ href: "/archive", text: "内链", internal: true }]);
    expect(doc.images).toEqual([{ src: "/cover.png", alt: "封面" }]);
    // stripMarkdown 行为：链接保留文字、图片整段移除（alt 不保留）
    expect(doc.contentText).toBe("你上 正文 内链 与 小节");
    expect(doc.contentText).not.toContain("##");
  });

  it("origin 尾斜杠被归一，description 空串归 null", () => {
    const doc = buildPageDocument({
      path: "/",
      title: "首页",
      description: "  ",
      site: { ...site, origin: "https://example.com/" },
    });
    expect(doc.site.origin).toBe("https://example.com");
    expect(doc.url).toBe("https://example.com/");
    expect(doc.description).toBeNull();
  });
});
