/**
 * Hexo 博客数据导入转换器
 * 支持 Hexo 的 Markdown 文件（source/_posts/ 目录下的 .md 文件）。
 * 用户可多选 .md 文件批量上传。
 *
 * Hexo 文件格式：
 * ---
 * title: 文章标题
 * date: 2023-01-01 12:00:00
 * tags:
 *   - tag1
 *   - tag2
 * categories:
 *   - category1
 * ---
 * Markdown 正文内容
 */
import type { ImportResult, PlatformInfo } from "./types";
import { parseMarkdownFile } from "./frontmatter";

async function convertHexoFiles(files: File[]): Promise<ImportResult> {
  const allTags = new Set<string>();
  const posts: ImportResult["posts"] = [];

  for (const file of files) {
    // 跳过非 Markdown 文件
    if (!file.name.match(/\.(md|markdown)$/i)) continue;

    const text = await file.text();
    const { frontmatter, content } = parseMarkdownFile(text, file.name);

    if (!content.trim() && !frontmatter.title) continue; // 跳过空文件

    // 合并 tags 和 categories
    const category = frontmatter.categories[0] || "";
    const tags = [
      ...new Set([...frontmatter.tags, ...frontmatter.categories]),
    ];
    tags.forEach((t) => allTags.add(t));

    // slug 推导：frontmatter > 文件名
    const slug =
      frontmatter.slug ||
      file.name
        .replace(/\.(md|markdown)$/i, "")
        .replace(/^\d{4}-\d{2}-\d{2}-/, ""); // 去掉日期前缀

    posts.push({
      slug,
      title: frontmatter.title || slug,
      content,
      excerpt: frontmatter.excerpt,
      coverImage: frontmatter.coverImage || undefined,
      published: !frontmatter.draft,
      pinned: false,
      listed: true,
      publishAt: normalizePublishAt(frontmatter.date),
      category,
      tags,
    });
  }

  const tagNames = Array.from(allTags);

  return {
    posts,
    tags: tagNames.map((name) => ({ name })),
    preview: {
      platform: "Hexo",
      postCount: posts.length,
      tagCount: tagNames.length,
      categoryCount: new Set(posts.map((post) => post.category).filter(Boolean)).size,
      commentCount: 0,
      postTitles: posts
        .slice(0, 20)
        .map((p) => ({ title: p.title, slug: p.slug })),
      tagNames,
      warnings:
        files.length !== posts.length
          ? [
              `共上传 ${files.length} 个文件，其中 ${posts.length} 个为有效 Markdown 文件`,
            ]
          : [],
    },
  };
}

export const hexoPlatform: PlatformInfo = {
  id: "hexo",
  name: "Hexo",
  description: "选择 source/_posts/ 目录下的 .md 文件（支持多选）",
  accept: ".md,.markdown",
  multiple: true,
  color: "blue",
  parse: convertHexoFiles,
};

function normalizePublishAt(date: string): string | null {
  if (!date) return null;
  const normalized = date.includes("T") ? date : date.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toISOString();
}
