// SEO 分析器：四维评分算法

export interface SeoCheckResult {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  score: number;
  detail: string;
}

export interface PostSeoReport {
  slug: string;
  title: string;
  totalScore: number;
  passedCount: number;
  totalCount: number;
  checks: SeoCheckResult[];
}

export interface SeoOverview {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalScore: number;
  scoreDistribution: { excellent: number; good: number; warn: number; poor: number };
  dimensionScores: { meta: number; structured: number; content: number; readability: number };
  globalChecks: SeoCheckResult[];
  postReports: PostSeoReport[];
  topKeywords: { word: string; count: number; weight: number }[];
}

export interface AnalyzeInput {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  tags: string[];
  coverImage: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

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

/** 去除 Markdown 标记，仅保留可读文本 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 中英混合分词 + 停用词过滤 */
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

/** 估算阅读时间（分钟） */
export function estimateReadingMinutes(text: string): number {
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return Math.max(1, Math.round((cn / 400) + (en / 250)));
}

/** H1/H2/H3 标题层级抽取 */
export function extractHeadingLevels(md: string): { h1: number; h2: number; h3: number } {
  const lines = md.split(/\r?\n/);
  let h1 = 0, h2 = 0, h3 = 0;
  for (const line of lines) {
    if (/^#\s+/.test(line)) h1++;
    else if (/^##\s+/.test(line)) h2++;
    else if (/^###\s+/.test(line)) h3++;
  }
  return { h1, h2, h3 };
}

/** 检测图片 alt 缺失 */
export function countImagesWithoutAlt(md: string): { total: number; missing: number } {
  const imgs = md.match(/!\[([^\]]*)\]\([^)]+\)/g) || [];
  let missing = 0;
  for (const img of imgs) {
    const m = img.match(/!\[([^\]]*)\]/);
    if (!m || !m[1].trim()) missing++;
  }
  return { total: imgs.length, missing };
}

/** 评估单篇文章的 SEO 健康度，返回 13 项检查结果 */
export function analyzePost(p: AnalyzeInput): PostSeoReport {
  const checks: SeoCheckResult[] = [];
  const titleLen = p.title.trim().length;
  const excerptLen = (p.excerpt || "").trim().length;
  const plainText = stripMarkdown(p.content);
  const wordCount = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length + (plainText.match(/[a-zA-Z]+/g) || []).length;
  const headings = extractHeadingLevels(p.content);
  const imgs = countImagesWithoutAlt(p.content);
  const internalLinks = (p.content.match(/\[[^\]]+\]\(\/[^)]*\)/g) || []).length;
  const externalLinks = (p.content.match(/\[[^\]]+\]\(https?:\/\/[^)]*\)/g) || []).length;
  const slugOk = /^[a-z0-9-]+$/.test(p.slug) && !p.slug.includes("--") && !p.slug.startsWith("-") && !p.slug.endsWith("-");

  // === Meta 元信息（4 项） ===
  checks.push({
    id: "title-length",
    label: "标题长度",
    status: titleLen >= 5 && titleLen <= 60 ? "pass" : titleLen < 5 ? "fail" : "warn",
    score: titleLen >= 5 && titleLen <= 60 ? 100 : titleLen < 5 ? 0 : 60,
    detail: `${titleLen} 字符，建议 5-60`,
  });
  checks.push({
    id: "excerpt-length",
    label: "摘要长度",
    status: excerptLen >= 60 && excerptLen <= 160 ? "pass" : excerptLen === 0 ? "fail" : "warn",
    score: excerptLen >= 60 && excerptLen <= 160 ? 100 : excerptLen === 0 ? 0 : 60,
    detail: excerptLen === 0 ? "未填写" : `${excerptLen} 字符，建议 60-160`,
  });
  checks.push({
    id: "slug-format",
    label: "URL Slug 规范",
    status: slugOk ? "pass" : "fail",
    score: slugOk ? 100 : 0,
    detail: slugOk ? p.slug : "需为小写字母+数字+短横线",
  });
  checks.push({
    id: "tags-coverage",
    label: "标签覆盖",
    status: p.tags.length >= 2 ? "pass" : p.tags.length === 1 ? "warn" : "fail",
    score: p.tags.length >= 2 ? 100 : p.tags.length === 1 ? 60 : 0,
    detail: `${p.tags.length} 个标签，建议 2-5`,
  });

  // === 结构化数据（3 项） ===
  checks.push({
    id: "cover-image",
    label: "封面图（OG）",
    status: p.coverImage ? "pass" : "warn",
    score: p.coverImage ? 100 : 50,
    detail: p.coverImage ? "已设置" : "缺失，社交分享将用默认图",
  });
  checks.push({
    id: "json-ld",
    label: "JSON-LD 结构化",
    status: p.published ? "pass" : "warn",
    score: p.published ? 100 : 50,
    detail: p.published ? "BlogPosting schema 自动注入" : "草稿不输出结构化数据",
  });
  checks.push({
    id: "canonical",
    label: "Canonical URL",
    status: "pass",
    score: 100,
    detail: "由 SeoHead 自动注入",
  });

  // === 内容质量（4 项） ===
  checks.push({
    id: "word-count",
    label: "正文字数",
    status: wordCount >= 300 ? "pass" : wordCount >= 100 ? "warn" : "fail",
    score: wordCount >= 300 ? 100 : wordCount >= 100 ? 60 : 20,
    detail: `${wordCount} 字，建议 ≥300`,
  });
  checks.push({
    id: "heading-structure",
    label: "标题层级",
    status: headings.h2 >= 2 ? "pass" : headings.h2 >= 1 ? "warn" : "fail",
    score: headings.h2 >= 2 ? 100 : headings.h2 >= 1 ? 60 : 20,
    detail: `H1 ${headings.h1} · H2 ${headings.h2} · H3 ${headings.h3}`,
  });
  checks.push({
    id: "image-alt",
    label: "图片 Alt",
    status: imgs.total === 0 ? "pass" : imgs.missing === 0 ? "pass" : imgs.missing < imgs.total ? "warn" : "fail",
    score: imgs.total === 0 ? 100 : Math.round(((imgs.total - imgs.missing) / imgs.total) * 100),
    detail: imgs.total === 0 ? "无图片" : `${imgs.total - imgs.missing}/${imgs.total} 含 alt`,
  });
  checks.push({
    id: "links",
    label: "链接密度",
    status: internalLinks + externalLinks >= 1 ? "pass" : "warn",
    score: internalLinks + externalLinks >= 1 ? 100 : 50,
    detail: `内链 ${internalLinks} · 外链 ${externalLinks}`,
  });

  // === 可读性 & 性能（2 项） ===
  const reading = estimateReadingMinutes(plainText);
  checks.push({
    id: "reading-time",
    label: "预计阅读时长",
    status: reading >= 2 && reading <= 15 ? "pass" : "warn",
    score: reading >= 2 && reading <= 15 ? 100 : 60,
    detail: `约 ${reading} 分钟`,
  });
  const paragraphs = p.content.split(/\n\n+/).filter(Boolean).length;
  checks.push({
    id: "paragraph-density",
    label: "段落密度",
    status: paragraphs >= 3 ? "pass" : paragraphs >= 1 ? "warn" : "fail",
    score: paragraphs >= 3 ? 100 : paragraphs >= 1 ? 60 : 0,
    detail: `${paragraphs} 段`,
  });

  const totalScore = Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length);
  const passedCount = checks.filter((c) => c.status === "pass").length;
  return {
    slug: p.slug,
    title: p.title,
    totalScore,
    passedCount,
    totalCount: checks.length,
    checks,
  };
}

/** 站点基础设施实测信号（来自页面端 fetch 结果） */
export interface SiteInfraSignal {
  /** sitemap 抓取状态 */
  sitemap?: { ok: boolean; urlCount: number; error?: string };
  /** robots 抓取状态 */
  robots?: { ok: boolean; hasSitemapDirective: boolean; error?: string };
  /** rss 抓取状态 */
  rss?: { ok: boolean; error?: string };
}

/** 汇总全站 SEO 概览 */
export function buildOverview(posts: AnalyzeInput[], infra?: SiteInfraSignal): SeoOverview {
  const reports = posts.map(analyzePost);
  const published = posts.filter((p) => p.published);
  const publishedReports = reports.filter((_, i) => posts[i].published);

  const dimAcc = { meta: [0, 0], structured: [0, 0], content: [0, 0], readability: [0, 0] };
  const dimMap: Record<string, keyof typeof dimAcc> = {
    "title-length": "meta", "excerpt-length": "meta", "slug-format": "meta", "tags-coverage": "meta",
    "cover-image": "structured", "json-ld": "structured", "canonical": "structured",
    "word-count": "content", "heading-structure": "content", "image-alt": "content", "links": "content",
    "reading-time": "readability", "paragraph-density": "readability",
  };
  for (const r of publishedReports) {
    for (const c of r.checks) {
      const key = dimMap[c.id];
      if (key) {
        dimAcc[key][0] += c.score;
        dimAcc[key][1] += 1;
      }
    }
  }
  const dimensionScores = {
    meta: dimAcc.meta[1] ? Math.round(dimAcc.meta[0] / dimAcc.meta[1]) : 0,
    structured: dimAcc.structured[1] ? Math.round(dimAcc.structured[0] / dimAcc.structured[1]) : 0,
    content: dimAcc.content[1] ? Math.round(dimAcc.content[0] / dimAcc.content[1]) : 0,
    readability: dimAcc.readability[1] ? Math.round(dimAcc.readability[0] / dimAcc.readability[1]) : 0,
  };
  const totalScore = Math.round((dimensionScores.meta + dimensionScores.structured + dimensionScores.content + dimensionScores.readability) / 4);

  const dist = { excellent: 0, good: 0, warn: 0, poor: 0 };
  for (const r of publishedReports) {
    if (r.totalScore >= 90) dist.excellent++;
    else if (r.totalScore >= 75) dist.good++;
    else if (r.totalScore >= 60) dist.warn++;
    else dist.poor++;
  }

  const globalChecks: SeoCheckResult[] = [
    infra?.sitemap
      ? infra.sitemap.ok && infra.sitemap.urlCount > 0
        ? { id: "sitemap", label: "Sitemap.xml", status: "pass", score: 100, detail: `已挂载 · ${infra.sitemap.urlCount} URLs` }
        : infra.sitemap.ok
        ? { id: "sitemap", label: "Sitemap.xml", status: "warn", score: 60, detail: "可访问但无 URL" }
        : { id: "sitemap", label: "Sitemap.xml", status: "fail", score: 0, detail: infra.sitemap.error || "抓取失败" }
      : { id: "sitemap", label: "Sitemap.xml", status: "warn", score: 60, detail: "未检测" },
    infra?.robots
      ? infra.robots.ok && infra.robots.hasSitemapDirective
        ? { id: "robots", label: "Robots.txt", status: "pass", score: 100, detail: "已挂载 · 含 Sitemap 指令" }
        : infra.robots.ok
        ? { id: "robots", label: "Robots.txt", status: "warn", score: 70, detail: "缺少 Sitemap 指令" }
        : { id: "robots", label: "Robots.txt", status: "fail", score: 0, detail: infra.robots.error || "抓取失败" }
      : { id: "robots", label: "Robots.txt", status: "warn", score: 60, detail: "未检测" },
    infra?.rss
      ? infra.rss.ok
        ? { id: "rss", label: "RSS Feed", status: "pass", score: 100, detail: "已挂载 /rss.xml" }
        : { id: "rss", label: "RSS Feed", status: "fail", score: 0, detail: infra.rss.error || "抓取失败" }
      : { id: "rss", label: "RSS Feed", status: "warn", score: 60, detail: "未检测" },
    { id: "prerender", label: "爬虫预渲染", status: "pass", score: 100, detail: "Pages Function 自动注入 OG" },
  ];

  // Top 关键词聚合（基于已发布文章 title + tags + 首段）
  const kwCounter = new Map<string, number>();
  for (const p of published) {
    const sample = p.title + " " + p.tags.join(" ") + " " + stripMarkdown(p.content).slice(0, 600);
    const local = extractKeywords(sample);
    for (const [w, c] of local) {
      if (w.length < 2 || w.length > 8) continue;
      kwCounter.set(w, (kwCounter.get(w) || 0) + c);
    }
  }
  const topKeywords = Array.from(kwCounter.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word, count], i, arr) => ({
      word,
      count,
      weight: arr.length ? count / arr[0][1] : 0,
    }));

  return {
    totalPosts: posts.length,
    publishedPosts: published.length,
    draftPosts: posts.length - published.length,
    totalScore,
    scoreDistribution: dist,
    dimensionScores,
    globalChecks,
    postReports: reports,
    topKeywords,
  };
}
