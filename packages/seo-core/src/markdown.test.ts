import { describe, expect, it } from "vitest";
import {
  countImagesWithoutAlt,
  estimateReadingMinutes,
  extractHeadings,
  extractHeadingLevels,
  extractImages,
  extractLinks,
  stripMarkdown,
} from "./markdown";

describe("stripMarkdown", () => {
  it("移除代码块、行内代码与图片，保留链接文字", () => {
    const md = "# 标题\n\n正文 `code` 与 [链接](https://a.com)。\n\n![图](/img.png)\n\n```js\nconst a = 1;\n```";
    const text = stripMarkdown(md);
    // 继承自 seo-analyzer 的行为：行内代码内容被整段丢弃
    expect(text).toContain("正文 与 链接。");
    expect(text).toContain("标题");
    expect(text).not.toContain("code");
    expect(text).not.toContain("const a");
    expect(text).not.toContain("img.png");
  });

  it("压缩连续空白并去首尾空格", () => {
    expect(stripMarkdown("  a  \n\n b  ")).toBe("a b");
  });
});

describe("extractHeadingLevels / extractHeadings", () => {
  it("统计 H1/H2/H3 数量", () => {
    const md = "# a\n## b\n### c\n#### d\n## e";
    expect(extractHeadingLevels(md)).toEqual({ h1: 1, h2: 2, h3: 1 });
  });

  it("extractHeadings 返回层级与文本（支持尾部闭合 #）", () => {
    const headings = extractHeadings("## 标题一 ##\n### 子节");
    expect(headings).toEqual([
      { level: 2, text: "标题一" },
      { level: 3, text: "子节" },
    ]);
  });
});

describe("extractLinks", () => {
  it("区分站内与外链，剥离代码块内的链接", () => {
    const md = [
      "[首页](/)",
      "[归档](/archive)",
      "[外链](https://example.com/x)",
      "[自动](<https://example.com/y>)",
      "```js\n[代码内](https://skip.me)\n```",
    ].join("\n");
    const links = extractLinks(md);
    expect(links).toHaveLength(4);
    expect(links.filter((l) => l.internal)).toHaveLength(2);
    expect(links.map((l) => l.href)).toContain("https://example.com/y");
    expect(links.map((l) => l.href)).not.toContain("https://skip.me");
  });

  it("图片语法 ![alt](src) 不计入链接", () => {
    const links = extractLinks("![封面](/cover.png)\n[正文链接](/a)");
    expect(links).toEqual([{ href: "/a", text: "正文链接", internal: true }]);
  });

  it("忽略非 http/站内协议的链接", () => {
    const links = extractLinks("[js](javascript:alert(1)) [mail](mailto:a@b.c)");
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe("mailto:a@b.c");
  });
});

describe("extractImages / countImagesWithoutAlt", () => {
  it("alt 为空记 null", () => {
    const images = extractImages("![有描述](/a.png)\n![](/b.png)\n![  ](/c.png)");
    expect(images).toEqual([
      { src: "/a.png", alt: "有描述" },
      { src: "/b.png", alt: null },
      { src: "/c.png", alt: null },
    ]);
    expect(countImagesWithoutAlt("![有描述](/a.png)\n![](/b.png)")).toEqual({ total: 2, missing: 1 });
  });

  it("代码块内的示例图片不计入", () => {
    expect(countImagesWithoutAlt("```\n![](/demo.png)\n```")).toEqual({ total: 0, missing: 0 });
  });
});

describe("estimateReadingMinutes", () => {
  it("中文 400 字/分钟、英文 250 词/分钟，至少 1 分钟", () => {
    expect(estimateReadingMinutes("字".repeat(400))).toBe(1);
    expect(estimateReadingMinutes("word ".repeat(500))).toBe(2);
    expect(estimateReadingMinutes("hi")).toBe(1);
  });
});
