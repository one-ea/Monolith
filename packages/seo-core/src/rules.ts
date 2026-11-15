/* Audit 规则引擎 —— AuditRule 注册表 + 执行器（任务书 §9）。
   category 区分 seo / geo / aeo，规则可渐进追加；findings 供控制台与编辑器展示。
   评分语义见 scoring.ts：Monolith 自定义健康度，不是搜索引擎官方评分。 */

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
import type { PageDocument, PageType } from "./types";

export type AuditStatus = "pass" | "warn" | "fail";
export type AuditCategory = "seo" | "geo" | "aeo";

export interface AuditFinding {
  id: string;
  category: AuditCategory;
  /** 维度：structure / citability / trust / freshness / accessibility */
  dimension: string;
  status: AuditStatus;
  title: string;
  detail: string;
  recommendation?: string;
}

export interface AuditRule {
  id: string;
  category: AuditCategory;
  dimension: string;
  title: string;
  /** 规则适用的页面类型，缺省为全部 */
  appliesTo?: PageType[];
  run(doc: PageDocument): { status: AuditStatus; detail: string; recommendation?: string };
}

const ARTICLE_ONLY: PageType[] = ["article"];

/** 首批 GEO 规则：文档级确定性启发式（任务书 §10.2 子集；网络可达性检查属控制台层） */
export const GEO_RULES: AuditRule[] = [
  {
    id: "geo-h1-unique",
    category: "geo",
    dimension: "structure",
    title: "唯一 H1 标题",
    appliesTo: ARTICLE_ONLY,
    run(doc) {
      const h1 = doc.headings.filter((h) => h.level === 1);
      if (h1.length === 0) return { status: "warn", detail: "正文中没有 H1（一级标题）。", recommendation: "为文章主体添加一个概括主题的 H1。" };
      if (h1.length > 1) return { status: "warn", detail: `检测到 ${h1.length} 个 H1。`, recommendation: "保留一个 H1，其余降级为 H2。" };
      return { status: "pass", detail: "正文包含唯一 H1。" };
    },
  },
  {
    id: "geo-heading-outline",
    category: "geo",
    dimension: "structure",
    appliesTo: ARTICLE_ONLY,
    title: "清晰的小节结构",
    run(doc) {
      const h2 = doc.headings.filter((h) => h.level === 2).length;
      if (doc.contentText.length < 200) return { status: "pass", detail: "篇幅较短，无需强制分节。" };
      if (h2 >= 2) return { status: "pass", detail: `包含 ${h2} 个 H2 小节。` };
      return { status: "warn", detail: `仅 ${h2} 个 H2 小节，长文不利于抽取与引用。`, recommendation: "按主题拆分为 H2/H3 小节。" };
    },
  },
  {
    id: "geo-definition-sentences",
    category: "geo",
    dimension: "citability",
    title: "定义式表述",
    appliesTo: ARTICLE_ONLY,
    run(doc) {
      const count = countDefinitionSentences(doc.contentText);
      if (count >= 1) return { status: "pass", detail: `检测到 ${count} 处定义式表述（「是指/是一种/用来…」）。` };
      return { status: "warn", detail: "未检测到定义式表述。", recommendation: "在开篇用一两句直接定义文章主题。" };
    },
  },
  {
    id: "geo-answer-first",
    category: "geo",
    dimension: "citability",
    title: "开篇直答主题",
    appliesTo: ARTICLE_ONLY,
    run(doc) {
      const topOf = (t: string) =>
        Array.from(extractKeywords(t).entries())
          .filter(([w]) => w.length >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([w]) => w);
      if (openingMentionsTopic(doc.title, doc.contentText, topOf)) {
        return { status: "pass", detail: "开篇段落命中标题关键词。" };
      }
      return { status: "warn", detail: "开篇 300 字内未命中标题关键词。", recommendation: "把结论或定义提前到第一段。" };
    },
  },
  {
    id: "geo-factual-signals",
    category: "geo",
    dimension: "citability",
    title: "事实性数据信号",
    appliesTo: ARTICLE_ONLY,
    run(doc) {
      const count = countFactualSignals(doc.contentText);
      if (count >= 3) return { status: "pass", detail: `检测到 ${count} 处数字/百分比/年份等事实信号。` };
      if (count >= 1) return { status: "warn", detail: `仅 ${count} 处事实信号。`, recommendation: "为关键论断补充可核验的数字或时间。" };
      return { status: "warn", detail: "未检测到事实性数据信号。", recommendation: "补充数字、百分比或年份等可引用事实。" };
    },
  },
  {
    id: "geo-quotable-statements",
    category: "geo",
    dimension: "citability",
    title: "可引用段落",
    appliesTo: ARTICLE_ONLY,
    run(doc) {
      if (hasBlockquote(doc.contentMarkdown || "")) return { status: "pass", detail: "包含 blockquote 引用块。" };
      return { status: "warn", detail: "未检测到引用块。", recommendation: "可将关键结论用 > 引用块突出。" };
    },
  },
  {
    id: "geo-vague-hedging",
    category: "geo",
    dimension: "citability",
    title: "模糊措辞密度",
    appliesTo: ARTICLE_ONLY,
    run(doc) {
      const density = hedgingDensity(doc.contentText);
      if (density <= 5) return { status: "pass", detail: `模糊限定词密度 ${density.toFixed(1)}/千字。` };
      if (density <= 15) return { status: "warn", detail: `模糊限定词密度 ${density.toFixed(1)}/千字，偏高。`, recommendation: "把「可能/也许」类表述换成可验证的论断。" };
      return { status: "fail", detail: `模糊限定词密度 ${density.toFixed(1)}/千字，过高。`, recommendation: "大幅减少模糊限定词。" };
    },
  },
  {
    id: "geo-keyword-stuffing",
    category: "geo",
    dimension: "citability",
    appliesTo: ARTICLE_ONLY,
    title: "关键词堆砌",
    run(doc) {
      const { ratio, word } = topKeywordRatio(doc.contentText, extractKeywords);
      if (ratio > 0.08) return { status: "fail", detail: `最高频词「${word}」占全文 token ${(ratio * 100).toFixed(1)}%。`, recommendation: "降低重复度，改用同义表述。" };
      if (ratio > 0.04) return { status: "warn", detail: `最高频词「${word}」占 ${(ratio * 100).toFixed(1)}%，略高。` };
      return { status: "pass", detail: "关键词分布正常。" };
    },
  },
  {
    id: "geo-external-references",
    category: "geo",
    dimension: "trust",
    title: "外部参考链接",
    appliesTo: ARTICLE_ONLY,
    run(doc) {
      const external = doc.links.filter((l) => !l.internal).length;
      if (external >= 2) return { status: "pass", detail: `包含 ${external} 个外部参考链接。` };
      if (external === 1) return { status: "warn", detail: "仅 1 个外部参考链接。" };
      return { status: "warn", detail: "没有外部参考链接。", recommendation: "为关键论断补充权威来源。" };
    },
  },
  {
    id: "geo-references-section",
    category: "geo",
    dimension: "trust",
    title: "参考资料章节",
    appliesTo: ARTICLE_ONLY,
    run(doc) {
      if (hasReferencesSection(doc.headings)) return { status: "pass", detail: "检测到「参考/来源」类章节。" };
      return { status: "warn", detail: "未检测到参考资料章节。", recommendation: "文末补充「参考资料」小节并列出来源。" };
    },
  },
  {
    id: "geo-author-identity",
    category: "geo",
    dimension: "trust",
    title: "作者身份明确",
    run(doc) {
      const name = doc.site.author.name?.trim();
      if (!name) return { status: "warn", detail: "站点未配置作者名。" };
      if (name === doc.site.title.trim()) {
        return { status: "warn", detail: "作者名与站名相同（疑似回退默认值）。", recommendation: "在控制台填写真实作者名。" };
      }
      return { status: "pass", detail: `作者：${name}。` };
    },
  },
  {
    id: "geo-freshness",
    category: "geo",
    dimension: "freshness",
    appliesTo: ARTICLE_ONLY,
    title: "内容新鲜度",
    run(doc) {
      if (!doc.modifiedAt && !doc.publishedAt) return { status: "warn", detail: "缺少发布/更新时间。" };
      const t = new Date(doc.modifiedAt || doc.publishedAt || "").getTime();
      if (Number.isNaN(t)) return { status: "warn", detail: "时间字段无法解析。" };
      const days = (Date.now() - t) / 86_400_000;
      if (days <= 180) return { status: "pass", detail: `距上次更新 ${Math.floor(days)} 天。` };
      if (days <= 365) return { status: "warn", detail: `距上次更新 ${Math.floor(days)} 天。` };
      return { status: "warn", detail: `距上次更新超过一年（${Math.floor(days)} 天）。`, recommendation: "复核内容是否仍然成立。" };
    },
  },
  {
    id: "geo-canonical-absolute",
    category: "geo",
    dimension: "accessibility",
    title: "Canonical 绝对地址",
    run(doc) {
      if (/^https?:\/\//i.test(doc.canonical)) return { status: "pass", detail: doc.canonical };
      return { status: "fail", detail: `canonical 不是绝对地址：${doc.canonical}` };
    },
  },
];

/** 执行审计：按 appliesTo 过滤后逐条运行，返回 findings（顺序与规则注册顺序一致） */
export function runAudit(doc: PageDocument, rules: AuditRule[] = GEO_RULES): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const rule of rules) {
    if (rule.appliesTo && !rule.appliesTo.includes(doc.type)) continue;
    const result = rule.run(doc);
    findings.push({
      id: rule.id,
      category: rule.category,
      dimension: rule.dimension,
      status: result.status,
      title: rule.title,
      detail: result.detail,
      recommendation: result.recommendation,
    });
  }
  return findings;
}
