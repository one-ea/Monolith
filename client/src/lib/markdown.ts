import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import DOMPurify from "dompurify";
import katex from "katex";


// 按需注册语言（避免打包过大）
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import css from "highlight.js/lib/languages/css";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import python from "highlight.js/lib/languages/python";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("css", css);
hljs.registerLanguage("c", c);
hljs.registerLanguage("h", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c++", cpp);
hljs.registerLanguage("cc", cpp);
hljs.registerLanguage("cxx", cpp);
hljs.registerLanguage("hpp", cpp);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("diff", diff);

// 配置 marked
const renderer = new marked.Renderer();

// 标题：注入 id 属性（用于 TOC 锚点）
function slugify(text: string): string {
  // 循环去除 HTML 标签（防止多字符序列截断后残留，如 <scr<script>ipt>）
  let cleaned = text;
  let prev = "";
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(/<[^>]*>/g, "");
  }
  return cleaned
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, "") // 保留中文、字母、数字、空格、连字符
    .replace(/\s+/g, "-")          // 空格转连字符
    .replace(/-+/g, "-")           // 合并连续连字符
    .replace(/^-|-$/g, "");        // 去除首尾连字符
}

renderer.heading = function ({ text, depth, tokens }: { text: string; depth: number; tokens?: any[] }) {
  const id = slugify(text); // slugify 用原始纯文本生成锚点 id
  // 用 parseInline 解析 inline 格式（粗体、代码等）为 HTML
  const html = tokens && this.parser
    ? this.parser.parseInline(tokens)
    : text;
  return `<h${depth} id="${id}">${html}</h${depth}>`;
};

// 代码块：高亮 + 语言标签 + 复制按钮 + 行号 + 标题 + 行高亮
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  // 解析语言标识和元信息，如 ts{1,3-5} 或 ts title="app.ts" 或 ts{1,3-5} title="app.ts"
  let language = "";
  let displayLanguage = "code";
  let title = "";
  let highlightLines = new Set<number>();

  if (lang) {
    // 提取 title="xxx" 或 title='xxx' 或 title=filename.ext（无空格）
    const titleMatch = lang.match(/title=["']([^"']+)["']/) || lang.match(/title=([\w./-]+)/);
    if (titleMatch) title = titleMatch[1];

    // 提取 {1,3-5,8} 行高亮
    const hlMatch = lang.match(/\{([\d,\s-]+)\}/);
    if (hlMatch) {
      hlMatch[1].split(",").forEach((seg) => {
        seg = seg.trim();
        const rangeMatch = seg.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          for (let i = start; i <= end; i++) highlightLines.add(i);
        } else if (/^\d+$/.test(seg)) {
          highlightLines.add(parseInt(seg));
        }
      });
    }

    // 提取纯语言名（去掉 {n} 和 title=xxx）
    const pureLang = lang
      .replace(/\{[\d,\s-]+\}/, "")
      .replace(/title=["'][^"']+["']/, "")
      .replace(/title=[\w./-]+/, "")
      .trim();
    if (pureLang) {
      displayLanguage = pureLang;
      language = hljs.getLanguage(pureLang) ? pureLang : "";
    }
  }

  // 检测是否为 diff 语言（特殊高亮 +/- 行）
  const isDiff = language === "diff";

  const highlighted = language
    ? hljs.highlight(text, { language }).value
    : escapeHtml(text);

  // 拆分为行，生成行号和高亮标记
  const lines = highlighted.split("\n");
  const rawLines = text.split("\n");
  
  // 去掉末尾空行
  if (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  const showLineNumbers = lines.length > 1; // 单行不显示行号

  const codeLines = lines.map((line, i) => {
    const lineNum = i + 1;
    const isHighlighted = highlightLines.has(lineNum);

    // diff 高亮：检测原始文本行前缀
    const rawLine = rawLines[i] || "";
    let diffClass = "";
    if (isDiff) {
      if (rawLine.startsWith("+")) diffClass = " diff-add";
      else if (rawLine.startsWith("-")) diffClass = " diff-del";
    }

    const hlClass = isHighlighted ? " line-highlight" : "";
    const numHtml = showLineNumbers ? `<span class="line-number">${lineNum}</span>` : "";

    return `<span class="code-line${hlClass}${diffClass}">${numHtml}<span class="line-content">${line}</span></span>`;
  }).join("\n");


  const langLabel = `<span class="code-lang">${escapeHtml(language || displayLanguage)}</span>`;

  const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

  const copyBtn = `<button class="copy-code-btn" aria-label="复制代码">${copyIcon}</button>`;

  const hasTitle = title ? " has-title" : "";
  const hasLineNums = showLineNumbers ? " has-line-numbers" : "";

  if (title) {
    // 有标题时：标题栏（macOS 圆点 + 标题 + 复制按钮）
    const titleBar = `<div class="code-title-bar"><span class="code-title-dots"><span></span><span></span><span></span></span><span class="code-title-text">${escapeHtml(title)}</span>${copyBtn}</div>`;
    return `<div class="code-block-wrapper${hasTitle}${hasLineNums}">
      ${titleBar}
      <pre class="hljs"><code class="hljs language-${language || "text"}">${codeLines}</code></pre>
    </div>`;
  } else {
    // 无标题时：顶部信息栏（语言标签 + 复制按钮）
    const header = `<div class="code-header">${langLabel}${copyBtn}</div>`;
    return `<div class="code-block-wrapper has-header${hasLineNums}">
      ${header}
      <pre class="hljs"><code class="hljs language-${language || "text"}">${codeLines}</code></pre>
    </div>`;
  }
};

// 图片/视频：懒加载 + 圆角 + 视频解析
renderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";

  let normalizedHref = href;
  try {
    normalizedHref = new URL(href, "https://monolith.local").toString();
  } catch {
    normalizedHref = href;
  }

  let mediaExtension = "";
  try {
    const videoUrl = new URL(normalizedHref, "https://monolith.local");
    const lastSegment = videoUrl.pathname.split("/").filter(Boolean).pop() || "";
    const dotIndex = lastSegment.lastIndexOf(".");
    mediaExtension = dotIndex >= 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : "";
  } catch {
    mediaExtension = "";
  }
  
  // 1. 直链视频支持
  if (["mp4", "webm", "ogg", "mov"].includes(mediaExtension)) {
    return `<figure class="md-figure md-video">
      <video src="${normalizedHref}" controls playsinline preload="metadata" class="w-full rounded-lg border border-border/20 shadow-lg bg-black/5"></video>
      ${text ? `<figcaption>${escapeHtml(text)}</figcaption>` : ""}
    </figure>`;
  }

  // 2. 哔哩哔哩 (Bilibili) 视频支持解析
  const bpxMatch = normalizedHref.match(/bilibili\.com\/video\/([a-zA-Z0-9]+)/i);
  if (bpxMatch) {
    const bvid = bpxMatch[1];
    return `<figure class="md-figure md-video">
      <div class="relative w-full aspect-video rounded-lg overflow-hidden border border-border/20 shadow-lg">
        <iframe src="//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" class="absolute inset-0 w-full h-full"></iframe>
      </div>
      ${text ? `<figcaption>${escapeHtml(text)}</figcaption>` : ""}
    </figure>`;
  }

  // 3. YouTube 视频支持解析
  const ytMatch = normalizedHref.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) {
    const ytid = ytMatch[1];
    return `<figure class="md-figure md-video">
      <div class="relative w-full aspect-video rounded-lg overflow-hidden border border-border/20 shadow-lg">
        <iframe src="https://www.youtube.com/embed/${ytid}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="absolute inset-0 w-full h-full"></iframe>
      </div>
      ${text ? `<figcaption>${escapeHtml(text)}</figcaption>` : ""}
    </figure>`;
  }

  // 默认图片渲染 — 懒加载 + 渐进淡入
  return `<figure class="md-figure"><img src="${normalizedHref}" alt="${escapeHtml(text)}" loading="lazy" decoding="async" data-lazy-img${titleAttr} class="lazy-img"/>${text ? `<figcaption>${escapeHtml(text)}</figcaption>` : ""}</figure>`;
};

// 表格：响应式包裹（兼容 marked v15+ 的 token 结构）
renderer.table = function (token: any) {
  // marked v15+ 传入的是 token 对象，header 和 rows 是嵌套 Token 数组
  // 需要手动构建 HTML 表格
  let headerHtml = "";
  let bodyHtml = "";

  // 处理表头
  if (token.header && Array.isArray(token.header)) {
    headerHtml = "<tr>" + token.header.map((cell: any) => {
      const align = cell.align ? ` style="text-align:${cell.align}"` : "";
      const cellText = cell.tokens
        ? this.parser.parseInline(cell.tokens)
        : (typeof cell.text === "string" ? cell.text : "");
      return `<th${align}>${cellText}</th>`;
    }).join("") + "</tr>";
  } else if (typeof token.header === "string") {
    headerHtml = token.header;
  }

  // 处理表体
  if (token.rows && Array.isArray(token.rows)) {
    bodyHtml = token.rows.map((row: any) => {
      if (!Array.isArray(row)) return typeof row === "string" ? row : "";
      return "<tr>" + row.map((cell: any) => {
        const align = cell.align ? ` style="text-align:${cell.align}"` : "";
        const cellText = cell.tokens
          ? this.parser.parseInline(cell.tokens)
          : (typeof cell.text === "string" ? cell.text : "");
        return `<td${align}>${cellText}</td>`;
      }).join("") + "</tr>";
    }).join("");
  } else if (typeof token.body === "string") {
    bodyHtml = token.body;
  }

  return `<div class="table-wrapper"><table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`;
};

// 链接：外部链接自动 target="_blank"（兼容 marked v15 token 结构）
renderer.link = function (token: any) {
  const href = token.href || '';
  // 防止 javascript: URI XSS
  if (/^\s*javascript:/i.test(href)) return escapeHtml(token.text || href);
  const title = token.title || '';
  const text = token.tokens && this.parser
    ? this.parser.parseInline(token.tokens)
    : (token.text || '');
  const isExternal = href.startsWith("http");
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  const externalAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
  return `<a href="${href}"${titleAttr}${externalAttrs}>${text}</a>`;
};

marked.setOptions({
  renderer,
  gfm: true,
  breaks: false,
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * u6570u5b66u516cu5f0fu9884u5904u7406uff1au5728 Markdown u89e3u6790u524du5c06 LaTeX u516cu5f0fu8f6cu4e3a KaTeX HTML
 * u652fu6301 $$...$$ u5757u7ea7u548c $...$ u884cu5185u516cu5f0f
 */
function renderMath(md: string): string {
  // u4fddu62a4u4ee3u7801u5757u548cu884cu5185u4ee3u7801uff0cu907fu514du5176u4e2du7684 $ u88abu8befu89e3u4e3au516cu5f0f
  const preserved: string[] = [];
  const ph = (s: string) => { preserved.push(s); return `\x00MATH_GUARD_${preserved.length - 1}\x00`; };
  md = md.replace(/```[\s\S]*?```/g, ph);
  md = md.replace(/`[^`]+`/g, ph);

  // u5757u7ea7u516cu5f0fuff1a$$...$$
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<pre class="math-error">${escapeHtml(tex)}</pre>`;
    }
  });
  // u884cu5185u516cu5f0fuff1a$...$uff08u907fu514du5339u914du8d27u5e01u7b26u53f7u5982 $100uff09
  md = md.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<code class="math-error">${escapeHtml(tex)}</code>`;
    }
  });

  // u8fd8u539fu4fddu62a4u7684u4ee3u7801u5757
  md = md.replace(/\x00MATH_GUARD_(\d+)\x00/g, (_, i) => preserved[parseInt(i)]);
  return md;
}

/**
 * u6e32u67d3 Markdown u4e3a HTMLuff08u5df2u901au8fc7 DOMPurify u51c0u5316uff0cu9632 XSSuff09
 * u652fu6301uff1au6807u9898/u7c97u4f53/u659cu4f53/u5220u9664u7ebf/u94feu63a5/u56feu7247/u4ee3u7801u5757(u9ad8u4eae)/u884cu5185u4ee3u7801/
 *       u8868u683c/u4efbu52a1u5217u8868/u6709u5e8fu65e0u5e8fu5217u8868/u5f15u7528/u5206u9694u7ebf/u811au6ce8/u6570u5b66u516cu5f0f(KaTeX)
 */
export function renderMarkdown(md: string): string {
  const mathProcessed = renderMath(md);
  const raw = marked.parse(mathProcessed, { async: false }) as string;
  // 净化 HTML，允许 iframe（B站/YouTube 嵌入）和代码块复制按钮所需的 data 属性
  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ["iframe", "video", "source", "figure", "figcaption",
      "math", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac",
      "mover", "munder", "msqrt", "mroot", "mtable", "mtr", "mtd",
      "mtext", "mspace", "annotation", "semantics", "mpadded",
      "menclose", "msubsup", "munderover", "mmultiscripts",
      "span"],
    ADD_ATTR: [
      "allow", "allowfullscreen", "frameborder", "scrolling",
      "playsinline", "preload", "controls",
      "loading", "decoding", "data-lazy-img",
      "target", "rel",
      "xmlns", "encoding", "mathvariant", "stretchy", "fence",
      "separator", "accent", "accentunder", "lspace", "rspace",
      "columnalign", "rowalign", "columnspacing", "rowspacing",
      "displaystyle", "scriptlevel", "minsize", "maxsize",
      "movablelimits", "symmetric", "linethickness", "columnspan",
      "rowspan", "depth", "height", "voffset", "width",
      "aria-hidden",
    ],
  });
}


/* ── TOC 辅助函数 ─────────────────────────── */

export type TocHeading = {
  id: string;
  text: string;
  level: number;
};

/**
 * 从 Markdown 源文本中提取标题列表（h2-h4）
 * 用于生成 Table of Contents
 */
export function extractHeadings(md: string): TocHeading[] {
  const headings: TocHeading[] = [];
  // 匹配 Markdown 标题语法：## ~ ####
  const regex = /^(#{2,4})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(md)) !== null) {
    const level = match[1].length;
    const rawText = match[2].trim();
    // 去除 Markdown 行内格式（粗体、斜体、代码等）
    const plainText = rawText
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1");
    headings.push({
      id: slugify(plainText),
      text: plainText,
      level,
    });
  }
  return headings;
}
