import { describe, expect, it } from "vitest";
import { buildPageDocument } from "./document";
import { GEO_RULES, runAudit } from "./rules";
import { summarizeAudit } from "./scoring";
import type { SiteContext } from "./types";

const site: SiteContext = {
  origin: "https://example.com",
  title: "测试站",
  description: "描述",
  author: { name: "作者" },
  locale: "zh-CN",
};

// 一篇高可引用性的文章：唯一 H1、双 H2、定义句、数字事实、引用块、外部参考、参考资料章节
const richMarkdown = [
  "# 边缘计算入门",
  "",
  "边缘计算是指把算力下沉到靠近数据源的位置的一种架构。延迟可降低 35%，2024 年多数平台 QPS 超过 8000。",
  "",
  "> 关键结论：把逻辑放到数据旁边。",
  "",
  "## 基本概念",
  "",
  "它是一种分布式体系，参考 [Cloudflare 文档](https://developers.cloudflare.com/)。",
  "",
  "## 参考资料",
  "",
  "- [规范](https://example.com/spec)",
  "",
  "更新于近期，内容详实。",
].join("\n");

const richDoc = buildPageDocument({
  path: "/posts/edge",
  title: "边缘计算入门",
  type: "article",
  contentMarkdown: richMarkdown,
  modifiedAt: new Date().toISOString(),
  tags: ["edge"],
  site,
});

const thinDoc = buildPageDocument({
  path: "/posts/thin",
  title: "随便写写",
  type: "article",
  contentMarkdown: "可能也许大概似乎都是些模糊的话。",
  site: { ...site, author: { name: site.title } },
});

describe("runAudit", () => {
  it("对 article 应用全部规则并返回稳定 id 集合", () => {
    const findings = runAudit(richDoc);
    expect(findings.map((f) => f.id)).toEqual(GEO_RULES.map((r) => r.id));
    expect(new Set(findings.map((f) => f.id)).size).toBe(findings.length);
  });

  it("非 article 页面跳过 article-only 规则（author/canonical 仍执行）", () => {
    const findings = runAudit(buildPageDocument({ path: "/", title: "", type: "website", site }));
    expect(findings.some((f) => f.id === "geo-definition-sentences")).toBe(false);
    expect(findings.some((f) => f.id === "geo-author-identity")).toBe(true);
    expect(findings.some((f) => f.id === "geo-canonical-absolute")).toBe(true);
  });

  it("高可引用性文章整体偏 pass；贫瘠文章出现 warn/fail", () => {
    const rich = runAudit(richDoc);
    const richPass = rich.filter((f) => f.status === "pass").length;
    expect(richPass).toBeGreaterThanOrEqual(rich.length - 3);

    const thin = runAudit(thinDoc);
    expect(thin.some((f) => f.status === "warn" || f.status === "fail")).toBe(true);
  });

  it("作者名回退站名时给出 warn 与建议", () => {
    const finding = runAudit(thinDoc).find((f) => f.id === "geo-author-identity");
    expect(finding?.status).toBe("warn");
    expect(finding?.recommendation).toBeTruthy();
  });
});

describe("summarizeAudit", () => {
  it("加权评分：pass=1、warn=0.5，维度分组", () => {
    const summary = summarizeAudit(runAudit(richDoc));
    expect(summary.score).toBeGreaterThanOrEqual(70);
    expect(summary.score).toBeLessThanOrEqual(100);
    expect(summary.dimensions.length).toBeGreaterThan(1);
    const totalChecks = summary.total.pass + summary.total.warn + summary.total.fail;
    expect(totalChecks).toBe(summary.dimensions.reduce((acc, d) => acc + d.pass + d.warn + d.fail, 0));
  });

  it("空 findings 返回满分且维度为空", () => {
    const summary = summarizeAudit([]);
    expect(summary.score).toBe(100);
    expect(summary.dimensions).toEqual([]);
  });
});
