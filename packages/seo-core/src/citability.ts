/* GEO 可引用性启发式原语 —— 全部确定性规则，无 ML、无外部服务。
   它们是「内容质量 / 可引用性」的启发式检查，不代表任何搜索引擎官方评分。 */

/** 定义句：包含「X 是指/是一种/指的是/定义为/用来/用于」等定义式表述 */
export function countDefinitionSentences(text: string): number {
  const re = /[^。；;！？!?\n]{1,40}(?:是指|是一种|指的是|被定义为|定义为|用来|用于)[^。；;！？!?\n]{0,80}/g;
  return (text.match(re) || []).length;
}

/** 事实性信号：带单位的数字 / 百分比 / 年份 */
export function countFactualSignals(text: string): number {
  // 使用有界量词，避免长数字串触发正则回溯。
  const re = /(\d{1,6}(?:\.\d{1,6})?\s*(?:%|％|ms|μs|s|秒|分钟|分|小时|时|天|周|月|年|kb|mb|gb|tb|px|倍|次|个|名|位|元|万|亿|k|qps|rps|fps|db)|\b(?:19|20)\d{2}\s*年\b|\b\d{1,6}(?:\.\d{1,6})?%)/gi;
  return (text.match(re) || []).length;
}

/** 是否存在「参考资料 / 来源 / References」类章节标题 */
export function hasReferencesSection(headings: { level: number; text: string }[]): boolean {
  const re = /^(参考|引用|资料|来源|延伸阅读|references|sources|bibliography|citation)/i;
  return headings.some((h) => re.test(h.text.trim()));
}

/** 是否存在引用块（Markdown blockquote） */
export function hasBlockquote(markdown: string): boolean {
  return /^\s*>[^>]/m.test(markdown);
}

/** 模糊措辞密度：每千字的模糊限定词数量 */
export function hedgingDensity(text: string): number {
  const re = /可能|也许|大概|或许|似乎|差不多|应该是|不一定|probably|maybe|perhaps|arguably/gi;
  const count = (text.match(re) || []).length;
  const length = stripToPlainLength(text);
  return length === 0 ? 0 : (count * 1000) / length;
}

/** 最高频关键词占全文 token 的比例（粗粒度堆砌检测） */
export function topKeywordRatio(text: string, extract: (t: string) => Map<string, number>): { ratio: number; word: string } {
  const keywords = extract(text);
  let word = "";
  let max = 0;
  for (const [w, c] of keywords) {
    if (c > max) { max = c; word = w; }
  }
  const cn = (text.match(/[一-龥]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  const total = cn + en;
  return { ratio: total === 0 || max === 0 ? 0 : max / total, word };
}

/** 开篇（前 300 字）是否命中标题关键词 —— 前置直答主题的粗判 */
export function openingMentionsTopic(title: string, contentText: string, topKeywordsOf: (t: string) => string[]): boolean {
  const opening = contentText.slice(0, 300);
  if (!opening) return false;
  return topKeywordsOf(title).some((word) => opening.includes(word));
}

function stripToPlainLength(text: string): number {
  const cn = (text.match(/[一-龥]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return cn + en;
}
