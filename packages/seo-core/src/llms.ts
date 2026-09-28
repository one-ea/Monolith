/* llms.txt 渲染 —— AI/Agent 友好内容索引（https://llmstxt.org/）
   数据直接来自发布文章/独立页面（D1），不 crawl 自己的站点。 */

export interface LlmsLinkEntry {
  title: string;
  /** 绝对地址 */
  url: string;
  description?: string;
  category?: string | null;
}

export interface LlmsFullEntry extends LlmsLinkEntry {
  markdown: string;
}

/** 单行化描述：折叠空白并截断，避免多行内容破坏列表结构 */
function toLineSummary(value: string | null | undefined, maxLength = 200): string {
  const line = (value || "").replace(/\s+/g, " ").trim();
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line;
}

/** 紧凑索引：H1 站点名 + 引用摘要 + 按分类分组的文章链接 + 独立页面 */
export function renderLlmsTxt(
  site: { title: string; description: string },
  posts: LlmsLinkEntry[],
  pages: LlmsLinkEntry[],
): string {
  const lines: string[] = [
    `# ${site.title}`,
    "",
    `> ${toLineSummary(site.description)}`,
    "",
  ];

  const sections = new Map<string, LlmsLinkEntry[]>();
  for (const post of posts) {
    const category = post.category?.trim() || "未分类";
    const list = sections.get(category) ?? [];
    list.push(post);
    sections.set(category, list);
  }
  for (const [category, entries] of sections) {
    lines.push(`## ${category}`, "");
    for (const entry of entries) {
      const summary = toLineSummary(entry.description);
      lines.push(summary ? `- [${entry.title}](${entry.url}): ${summary}` : `- [${entry.title}](${entry.url})`);
    }
    lines.push("");
  }

  if (pages.length > 0) {
    lines.push("## 独立页面", "");
    for (const page of pages) {
      const summary = toLineSummary(page.description);
      lines.push(summary ? `- [${page.title}](${page.url}): ${summary}` : `- [${page.title}](${page.url})`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/** 全文输出：每篇文章一个 H2 + 自动链接 URL + 原始 Markdown，条目间以 --- 分隔 */
export function renderLlmsFullTxt(
  site: { title: string; description: string },
  posts: LlmsFullEntry[],
): string {
  const parts: string[] = [
    `# ${site.title}`,
    "",
    `> ${toLineSummary(site.description)}`,
    "",
  ];
  for (const post of posts) {
    const heading = post.title.replace(/\s+/g, " ").trim();
    parts.push(`## ${heading}`, "", `<${post.url}>`, "", post.markdown.trimEnd(), "", "---", "");
  }
  return `${parts.join("\n").trimEnd()}\n`;
}
