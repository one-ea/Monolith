import { describe, expect, it } from "vitest";
import { extractKeywords } from "./keywords";

describe("extractKeywords", () => {
  it("英文按词计数并过滤停用词", () => {
    const counter = extractKeywords("cloudflare workers edge cloudflare the and");
    expect(counter.get("cloudflare")).toBe(2);
    expect(counter.get("workers")).toBe(1);
    expect(counter.has("the")).toBe(false);
  });

  it("中文按 bigram 计数并过滤停用词", () => {
    const counter = extractKeywords("边缘计算实践");
    expect(counter.get("边缘")).toBe(1);
    expect(counter.get("计算")).toBe(1);
    expect(counter.has("的")).toBe(false);
  });

  it("先剥离 Markdown 标记再分词（链接 URL 不进词表）", () => {
    const counter = extractKeywords("cloudflare 边缘计算 [链接](https://x.com)");
    expect(counter.get("cloudflare")).toBe(1);
    expect(counter.get("边缘")).toBe(1);
    expect(counter.has("https")).toBe(false);
    expect(counter.has("x")).toBe(false);
  });
});
