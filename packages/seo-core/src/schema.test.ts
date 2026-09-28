import { describe, expect, it } from "vitest";
import { buildPageDocument } from "./document";
import { buildJsonLdGraph, renderJsonLdScript } from "./schema";
import type { PageDocument, SiteContext } from "./types";

const site: SiteContext = {
  origin: "https://example.com",
  title: "测试站",
  description: "站点描述",
  author: { name: "作者", url: "https://example.com/about", avatar: "/avatar.png" },
  locale: "zh-CN",
};

const articleDoc = buildPageDocument({
  path: "/posts/a",
  title: "文章标题",
  type: "article",
  description: "页面描述",
  contentMarkdown: "# a",
  coverImage: "/cover.png",
  publishedAt: "2026-01-01T00:00:00Z",
  tags: ["edge"],
  breadcrumbs: [
    { name: "首页", url: "/" },
    { name: "文章标题", url: "/posts/a" },
  ],
  site,
});

function nodeIds(doc: PageDocument): string[] {
  return buildJsonLdGraph(doc)["@graph"]
    .map((node) => node["@id"])
    .filter((id): id is string => typeof id === "string");
}

describe("buildJsonLdGraph", () => {
  it("输出单一 @graph，@id 唯一", () => {
    const graph = buildJsonLdGraph(articleDoc);
    expect(graph["@context"]).toBe("https://schema.org");
    const ids = nodeIds(articleDoc);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("文章页含 WebSite/Person/Organization/WebPage/BlogPosting/BreadcrumbList 并用 @id 互引", () => {
    const graph = buildJsonLdGraph(articleDoc);
    const types = graph["@graph"].map((n) => n["@type"]);
    expect(types).toEqual(
      expect.arrayContaining(["WebSite", "Person", "Organization", "WebPage", "BlogPosting", "BreadcrumbList"]),
    );

    const article = graph["@graph"].find((n) => n["@type"] === "BlogPosting");
    expect(article).toMatchObject({
      headline: "文章标题",
      author: { "@id": "https://example.com/#author" },
      publisher: { "@id": "https://example.com/#organization" },
      isPartOf: { "@id": "https://example.com/posts/a#webpage" },
      datePublished: "2026-01-01T00:00:00Z",
      keywords: "edge",
    });
  });

  it("非文章页不输出 BlogPosting，也不声明 SearchAction", () => {
    const home = buildJsonLdGraph(buildPageDocument({ path: "/", title: "", site }));
    const types = home["@graph"].map((n) => n["@type"]);
    expect(types).not.toContain("BlogPosting");
    expect(JSON.stringify(home)).not.toContain("SearchAction");
  });

  it("面包屑 item 归一为绝对地址", () => {
    const graph = buildJsonLdGraph(articleDoc);
    const breadcrumb = graph["@graph"].find((n) => n["@type"] === "BreadcrumbList") as {
      itemListElement: { item: string }[];
    };
    expect(breadcrumb.itemListElement[0].item).toBe("https://example.com/");
    expect(breadcrumb.itemListElement[1].item).toBe("https://example.com/posts/a");
  });
});

describe("renderJsonLdScript", () => {
  it("输出 ld+json script 且转义 < 防止提前闭合", () => {
    const script = renderJsonLdScript({ ...articleDoc, title: "a<b" });
    expect(script.startsWith('<script type="application/ld+json" data-seo="json-ld">')).toBe(true);
    expect(script).toContain("\\u003c");
    expect(script).not.toMatch(/<script[^>]*>[^<]*<\/script>[^<]*<\/script>$/);
    expect(script.endsWith("</script>")).toBe(true);
  });
});
