/* 审计评分聚合 —— Monolith 自定义健康度指标（pass/warn/fail 加权）。
   明确不是搜索引擎或 AI 引擎的官方评分，仅用于站内自检与趋势对比。 */

import type { AuditFinding } from "./rules";

export interface AuditDimensionScore {
  dimension: string;
  score: number;
  pass: number;
  warn: number;
  fail: number;
}

export interface AuditSummary {
  total: { pass: number; warn: number; fail: number };
  /** 0-100：pass 计 1 分，warn 计 0.5 分 */
  score: number;
  dimensions: AuditDimensionScore[];
}

export function summarizeAudit(findings: AuditFinding[]): AuditSummary {
  const total = { pass: 0, warn: 0, fail: 0 };
  const byDimension = new Map<string, AuditDimensionScore>();

  for (const finding of findings) {
    total[finding.status] += 1;
    const dimension = byDimension.get(finding.dimension) ?? {
      dimension: finding.dimension,
      score: 0,
      pass: 0,
      warn: 0,
      fail: 0,
    };
    dimension[finding.status] += 1;
    byDimension.set(finding.dimension, dimension);
  }

  const weighted = (pass: number, warn: number, fail: number) => {
    const count = pass + warn + fail;
    return count === 0 ? 100 : Math.round((100 * (pass + 0.5 * warn)) / count);
  };

  for (const dimension of byDimension.values()) {
    dimension.score = weighted(dimension.pass, dimension.warn, dimension.fail);
  }

  return {
    total,
    score: weighted(total.pass, total.warn, total.fail),
    dimensions: Array.from(byDimension.values()),
  };
}
