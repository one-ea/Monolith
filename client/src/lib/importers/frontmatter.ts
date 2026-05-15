/**
 * Markdown Frontmatter 解析器
 * 支持 YAML（Hexo / Hugo / Jekyll）和 TOML（Hugo）两种格式。
 * 轻量实现，仅提取博客迁移所需的元数据字段，零依赖。
 */

export interface FrontmatterData {
  title: string;
  date: string;
  tags: string[];
  categories: string[];
  draft: boolean;
  slug: string;
  excerpt: string;
  coverImage: string;
  [key: string]: unknown;
}

export interface ParsedMarkdownFile {
  frontmatter: FrontmatterData;
  content: string;
}

/**
 * 解析 Markdown 文件内容，分离 frontmatter 和正文。
 * 自动检测 YAML (---) 或 TOML (+++) 分隔符。
 */
export function parseMarkdownFile(
  raw: string,
  filename?: string
): ParsedMarkdownFile {
  const trimmed = raw.trimStart();

  let frontmatter: FrontmatterData;
  let content: string;

  if (trimmed.startsWith("---")) {
    // YAML frontmatter
    const endIndex = trimmed.indexOf("\n---", 3);
    if (endIndex === -1) {
      frontmatter = createEmptyFrontmatter();
      content = raw;
    } else {
      const yamlBlock = trimmed.substring(3, endIndex).trim();
      frontmatter = parseYamlFrontmatter(yamlBlock);
      content = trimmed.substring(endIndex + 4).trim();
    }
  } else if (trimmed.startsWith("+++")) {
    // TOML frontmatter (Hugo)
    const endIndex = trimmed.indexOf("\n+++", 3);
    if (endIndex === -1) {
      frontmatter = createEmptyFrontmatter();
      content = raw;
    } else {
      const tomlBlock = trimmed.substring(3, endIndex).trim();
      frontmatter = parseTomlFrontmatter(tomlBlock);
      content = trimmed.substring(endIndex + 4).trim();
    }
  } else {
    frontmatter = createEmptyFrontmatter();
    content = raw;
  }

  // 如果 frontmatter 中没有 slug，尝试从文件名推断
  if (!frontmatter.slug && filename) {
    frontmatter.slug = slugFromFilename(filename);
  }

  // 如果没有 title，用文件名作后备
  if (!frontmatter.title && filename) {
    frontmatter.title = filename.replace(/\.(md|markdown)$/i, "");
  }

  return { frontmatter, content };
}

function createEmptyFrontmatter(): FrontmatterData {
  return {
    title: "",
    date: "",
    tags: [],
    categories: [],
    draft: false,
    slug: "",
    excerpt: "",
    coverImage: "",
  };
}

/**
 * 从文件名推导 slug。
 * 支持 Jekyll 的 `YYYY-MM-DD-slug.md` 以及普通的 `slug.md` 命名。
 */
function slugFromFilename(filename: string): string {
  // 去掉路径，只取文件名
  const base = filename.split("/").pop() || filename;
  const name = base.replace(/\.(md|markdown)$/i, "");
  // Jekyll 格式: YYYY-MM-DD-slug
  const jekyllMatch = name.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  if (jekyllMatch) return jekyllMatch[1];
  return name;
}

// ─── YAML 解析 ─────────────────────────────────

function parseYamlFrontmatter(yaml: string): FrontmatterData {
  const result = createEmptyFrontmatter();
  const lines = yaml.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (typeof line !== "string") {
      i++;
      continue;
    }
    const keyMatch = line.match(/^(\w[\w-]*):\s*(.*)/);

    if (!keyMatch) {
      i++;
      continue;
    }

    const key = keyMatch[1].toLowerCase();
    let value = keyMatch[2].trim();

    // 检查是否是 block array（下一行以 - 开头且缩进）
    if (value === "" || value === "|" || value === ">") {
      // 检测 block array
      const arrayItems: string[] = [];
      let j = i + 1;
      let nextLine = lines[j];
      while (typeof nextLine === "string" && /^\s+-\s+/.test(nextLine)) {
        arrayItems.push(nextLine.replace(/^\s+-\s+/, "").trim());
        j++;
        nextLine = lines[j];
      }
      if (arrayItems.length > 0) {
        assignArrayField(result, key, arrayItems);
        i = j;
        continue;
      }
    }

    // Inline array: [item1, item2]
    if (value.startsWith("[") && value.endsWith("]")) {
      const items = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
      assignArrayField(result, key, items);
      i++;
      continue;
    }

    // 去除引号
    value = value.replace(/^['"]|['"]$/g, "");

    // 赋值
    switch (key) {
      case "title":
        result.title = value;
        break;
      case "date":
        result.date = value;
        break;
      case "slug":
      case "url":
      case "permalink":
        result.slug = value.replace(/^\/|\/$/g, "");
        break;
      case "draft":
        result.draft = value === "true";
        break;
      case "published":
        result.draft = value === "false";
        break;
      case "excerpt":
      case "summary":
      case "description":
        result.excerpt = value;
        break;
      case "cover":
      case "cover_image":
      case "coverimage":
      case "thumbnail":
      case "banner":
      case "image":
        result.coverImage = value;
        break;
      case "tags":
        // 可能是单个值
        if (value) result.tags.push(value);
        break;
      case "categories":
      case "category":
        if (value) result.categories.push(value);
        break;
    }

    i++;
  }

  return result;
}

// ─── TOML 解析（Hugo 专用）───────────────────────

function parseTomlFrontmatter(toml: string): FrontmatterData {
  const result = createEmptyFrontmatter();
  const lines = toml.split("\n");

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*=\s*(.*)/);
    if (!kvMatch) continue;

    const key = kvMatch[1].toLowerCase();
    let value = kvMatch[2].trim();

    // TOML array: ["item1", "item2"]
    if (value.startsWith("[") && value.endsWith("]")) {
      const items = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
      assignArrayField(result, key, items);
      continue;
    }

    // TOML boolean
    if (value === "true" || value === "false") {
      if (key === "draft") result.draft = value === "true";
      continue;
    }

    // 去除引号
    value = value.replace(/^['"]|['"]$/g, "");

    switch (key) {
      case "title":
        result.title = value;
        break;
      case "date":
        result.date = value;
        break;
      case "slug":
        result.slug = value;
        break;
      case "description":
      case "summary":
        result.excerpt = value;
        break;
      case "cover":
      case "cover_image":
      case "coverimage":
      case "thumbnail":
      case "banner":
      case "image":
        result.coverImage = value;
        break;
    }
  }

  return result;
}

// ─── 辅助 ──────────────────────────────────────

function assignArrayField(
  result: FrontmatterData,
  key: string,
  items: string[]
) {
  switch (key) {
    case "tags":
    case "tag":
      result.tags.push(...items);
      break;
    case "categories":
    case "category":
      result.categories.push(...items);
      break;
  }
}
