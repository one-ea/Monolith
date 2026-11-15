import { describe, expect, it } from "vitest";
import { renderLlmsFullTxt, renderLlmsTxt } from "./llms";

const site = { title: "测试站", description: "一句\n多行的   描述" };
const posts = [
  { title: "文章 A", url: "https://example.com/posts/a", description: "摘要 A", category: "边缘计算" },
  { title: "文章 B", url: "https://example.com/posts/b", description: "", category: null },
  { title: "文章 C", url: "https://example.com/posts/c", description: "边缘计算下的另一篇", category: "边缘计算" },
];

describe("renderLlmsTxt", () => {
  const txt = renderLlmsTxt(site, posts, [{ title: "关于", url: "https://example.com/page/about" }]);

  it("首行 H1 站点名，第二段为单行化引用摘要", () => {
    expect(txt.startsWith("# 测试站\n\n> 一句 多行的 描述\n\n")).toBe(true);
  });

  it("按分类分组，空分类归入未分类", () => {
    expect(txt).toContain("## 边缘计算");
    expect(txt).toContain("## 未分类");
    expect(txt.indexOf("文章 A") < txt.indexOf("文章 C")).toBe(true);
  });

  it("链接行带冒号摘要；空摘要省略冒号", () => {
    expect(txt).toContain("- [文章 A](https://example.com/posts/a): 摘要 A");
    expect(txt).toContain("- [文章 B](https://example.com/posts/b)");
  });

  it("独立页面独立成节；无页面时不输出该节", () => {
    expect(txt).toContain("## 独立页面");
    expect(txt).toContain("- [关于](https://example.com/page/about)");
    expect(renderLlmsTxt(site, posts, [])).not.toContain("独立页面");
  });

  it("超长描述截断到一行", () => {
    const long = renderLlmsTxt(site, [{ title: "t", url: "https://x/y", description: "长".repeat(300) }], []);
    const line = long.split("\n").find((l) => l.startsWith("- [t]")) || "";
    expect(line.length).toBeLessThanOrEqual("- [t](https://x/y): ".length + 200);
  });
});

describe("renderLlmsFullTxt", () => {
  it("每篇文章一个 H2 + 自动链接 + 原文，--- 分隔", () => {
    const full = renderLlmsFullTxt(site, [
      { title: "文 章\n标题", url: "https://example.com/posts/a", markdown: "# 正文\n\n内容" },
    ]);
    expect(full.startsWith("# 测试站\n\n> 一句 多行的 描述\n\n")).toBe(true);
    expect(full).toContain("## 文 章 标题");
    expect(full).toContain("<https://example.com/posts/a>");
    expect(full).toContain("# 正文\n\n内容");
    expect(full.trimEnd().endsWith("---")).toBe(true);
  });
});
