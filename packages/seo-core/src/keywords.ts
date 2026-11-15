/* 中英混合分词 + 停用词过滤（行为继承自 client/src/lib/seo-analyzer.ts） */

import { stripMarkdown } from "./markdown";

const CN_STOPWORDS = new Set([
  "的", "了", "和", "是", "在", "我", "有", "也", "就", "都", "而", "及", "与", "或", "一个", "没有",
  "这", "那", "你", "他", "她", "它", "我们", "你们", "他们", "自己", "什么", "怎么", "可以", "因为",
  "所以", "但是", "如果", "虽然", "然后", "因此", "已经", "正在", "可能", "应该", "需要", "对于",
  "通过", "进行", "使用", "包括", "其他", "这个", "那个", "这样", "那样", "一些", "比如", "例如",
  "this", "that", "with", "from", "have", "been", "were", "will", "would", "could", "should",
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one",
  "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see",
  "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use",
]);

export function extractKeywords(text: string): Map<string, number> {
  const counter = new Map<string, number>();
  const cleaned = stripMarkdown(text).toLowerCase();
  const englishWords = cleaned.match(/[a-z]{3,}/g) || [];
  for (const w of englishWords) {
    if (CN_STOPWORDS.has(w)) continue;
    counter.set(w, (counter.get(w) || 0) + 1);
  }
  const cnText = cleaned.replace(/[a-z0-9\s\p{P}]/gu, "");
  for (let i = 0; i < cnText.length - 1; i++) {
    const bigram = cnText.slice(i, i + 2);
    if (CN_STOPWORDS.has(bigram)) continue;
    counter.set(bigram, (counter.get(bigram) || 0) + 1);
  }
  return counter;
}
