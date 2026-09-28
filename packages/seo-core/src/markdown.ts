/* Markdown 源文本解析 —— SEO/GEO/审计共用的最小解析层。
   Monolith 的内容源就是 Markdown（存 D1），因此不需要任何 HTML parser，
   全部用确定性正则实现（评估报告 §11 bundle 风险结论）。 */

export type HeadingRef = { level: number; text: string };
export type LinkRef = { href: string; text: string; internal: boolean };
export type ImageRef = { src: string; alt: string | null };

/** 去除 Markdown 标记，仅保留可读文本（行为继承自 client/src/lib/seo-analyzer.ts） */
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

/** H1/H2/H3 计数（行为继承自 seo-analyzer） */
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

/** 全量标题抽取（1-6 级）。不生成锚点 id —— 锚点由渲染器决定，Phase 1c 统一。 */
export function extractHeadings(md: string): HeadingRef[] {
  const headings: HeadingRef[] = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim() });
  }
  return headings;
}

/** 剥离代码块与行内代码，避免把示例代码里的链接/图片当正文内容 */
function stripCodeBlocks(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ");
}

/** 抽取正文链接：`[text](href)` 与自动链接 `<https://…>`；锚点(#)算站内；`![…](…)` 图片语法不计入 */
export function extractLinks(md: string): LinkRef[] {
  const links: LinkRef[] = [];
  const text = stripCodeBlocks(md);
  let m: RegExpExecArray | null;

  const inline = /(?<!!)\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\)/g;
  while ((m = inline.exec(text)) !== null) {
    const href = m[2];
    if (/^(https?:\/\/|\/|#|mailto:)/i.test(href)) {
      links.push({
        href,
        text: (m[1] || "").trim(),
        internal: href.startsWith("/") || href.startsWith("#"),
      });
    }
  }

  const autolink = /<((?:https?:\/\/)[^>\s]+)>/g;
  while ((m = autolink.exec(text)) !== null) {
    links.push({ href: m[1], text: m[1], internal: false });
  }
  return links;
}

/** 抽取正文图片与 alt（alt 为空记 null） */
export function extractImages(md: string): ImageRef[] {
  const images: ImageRef[] = [];
  const text = stripCodeBlocks(md);
  const re = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    images.push({ src: m[2], alt: m[1].trim() || null });
  }
  return images;
}

/** 图片 alt 缺失统计（基于 extractImages；代码块内的示例图片不计入） */
export function countImagesWithoutAlt(md: string): { total: number; missing: number } {
  const images = extractImages(md);
  return { total: images.length, missing: images.filter((i) => !i.alt).length };
}

/** 阅读时长估算：中文 400 字/分钟，英文 250 词/分钟（行为继承自 seo-analyzer） */
export function estimateReadingMinutes(text: string): number {
  const cn = (text.match(/[一-龥]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return Math.max(1, Math.round((cn / 400) + (en / 250)));
}
