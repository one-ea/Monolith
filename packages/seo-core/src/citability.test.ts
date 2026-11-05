import { describe, expect, it } from "vitest";
import {
  countDefinitionSentences,
  countFactualSignals,
  hasBlockquote,
  hasReferencesSection,
  hedgingDensity,
  openingMentionsTopic,
  topKeywordRatio,
} from "./citability";
import { extractKeywords } from "./keywords";

describe("countDefinitionSentences", () => {
  it("命中是指/是一种/用来等定义式表述", () => {
    const text = "边缘计算是指把算力下沉到靠近数据源的位置。它是一种网络架构。";
    expect(countDefinitionSentences(text)).toBe(2);
  });
  it("普通叙述不计入", () => {
    expect(countDefinitionSentences("今天天气很好，我们去散步了。")).toBe(0);
  });
});

describe("countFactualSignals", () => {
  it("统计带单位数字、百分比与年份；裸数字不计入", () => {
    const text = "延迟降低了 35%，约 12ms；2024 年的 QPS 达到 8000 次。";
    expect(countFactualSignals(text)).toBe(4);
    expect(countFactualSignals("一共 8000。")).toBe(0);
  });
});

describe("hasReferencesSection", () => {
  it("识别参考/来源类标题", () => {
    expect(hasReferencesSection([{ level: 2, text: "参考资料" }])).toBe(true);
    expect(hasReferencesSection([{ level: 2, text: "References" }])).toBe(true);
    expect(hasReferencesSection([{ level: 2, text: "实现细节" }])).toBe(false);
  });
});

describe("hasBlockquote", () => {
  it("识别 Markdown 引用块（单层 >），排除纯嵌套 >>", () => {
    expect(hasBlockquote("正文\n\n> 关键结论\n")).toBe(true);
    expect(hasBlockquote(">嵌套引用")).toBe(true);
    expect(hasBlockquote(">> 纯嵌套")).toBe(false);
    expect(hasBlockquote("普通段落")).toBe(false);
  });
});

describe("hedgingDensity", () => {
  it("按千字密度统计模糊限定词", () => {
    const text = `${"可能".repeat(5)}${"长".repeat(995)}`;
    expect(hedgingDensity(text)).toBeGreaterThan(4.5);
    expect(hedgingDensity(text)).toBeLessThanOrEqual(5);
    expect(hedgingDensity("没有任何模糊词的正文内容")).toBe(0);
  });
});

describe("topKeywordRatio", () => {
  it("计算最高频词占比", () => {
    const text = "cloudflare cloudflare cloudflare 是一个平台平台平台";
    const { ratio } = topKeywordRatio(text, extractKeywords);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(0.5);
  });
});

describe("openingMentionsTopic", () => {
  it("开篇命中标题关键词", () => {
    const topOf = () => ["边缘计算"];
    expect(openingMentionsTopic("什么是边缘计算", "边缘计算把算力下沉到边缘。", topOf)).toBe(true);
    expect(openingMentionsTopic("什么是边缘计算", "今天聊聊别的。".repeat(10), topOf)).toBe(false);
  });
});
