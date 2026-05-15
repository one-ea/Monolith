import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { fetchPost, createPost, updatePost, uploadImage, localizePostImages, fetchPostVersions, restorePostVersion, type PostVersion } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import { Save, Eye, EyeOff, Upload, Image, ChevronDown, ChevronUp, Bold, Italic, Heading2, Heading3, Link2, Code, Quote, List, ListOrdered, Minus, Maximize2, Minimize2, Table, CheckSquare, FileCode, ImageDown, History, Check, X, ArrowDownUp, PanelRightClose, PanelRight, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import Editor, { type Monaco } from "@monaco-editor/react";
import type * as MonacoTypes from "monaco-editor";

/** 注册 Monolith 暗色主题 — 暗夜琥珀：黑 + 金点缀 */
function handleEditorWillMount(monaco: Monaco) {
  monaco.editor.defineTheme("monolith-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      // ─── Markdown 专属 ───
      { token: "markup.heading", foreground: "e0a84c", fontStyle: "bold" },
      { token: "markup.bold", foreground: "EBEBEB", fontStyle: "bold" },
      { token: "markup.italic", foreground: "d4a76a", fontStyle: "italic" },
      { token: "string.link", foreground: "7ec8e6" },
      { token: "markup.underline.link", foreground: "7ec8e6" },
      { token: "markup.inline.raw", foreground: "8ed8aa" },
      { token: "markup.fenced_code", foreground: "8ed8aa" },
      { token: "markup.list", foreground: "e0a84c" },
      { token: "markup.quote", foreground: "9a9a9a", fontStyle: "italic" },
      // ─── 通用 ───
      { token: "comment", foreground: "7a7a7a", fontStyle: "italic" },
      { token: "keyword", foreground: "e0a84c" },
      { token: "string", foreground: "8ed8aa" },
      { token: "number", foreground: "d4a76a" },
      { token: "type", foreground: "7ec8e6" },
      { token: "variable", foreground: "d8d4ce" },
      { token: "operator", foreground: "b0b0b0" },
    ],
    colors: {
      // 背景：中性深灰（不带蓝紫调）
      "editor.background": "#1c1c1e",
      "editor.foreground": "#EBEBEB",
      // 行高亮 — 微暖灰
      "editor.lineHighlightBackground": "#222224",
      "editor.lineHighlightBorder": "#00000000",
      // 选区 — 中性灰
      "editor.selectionBackground": "#44444450",
      "editor.inactiveSelectionBackground": "#33333330",
      "editor.selectionHighlightBackground": "#44444425",
      // 光标 — 琥珀金
      "editorCursor.foreground": "#e0a84c",
      "editorCursor.background": "#1c1c1e",
      // 辅助元素
      "editorWhitespace.foreground": "#2a2a2c",
      "editorIndentGuide.background": "#2a2a2c",
      "editorIndentGuide.activeBackground": "#3a3a3c",
      "editorLineNumber.foreground": "#4a4a4c",
      "editorLineNumber.activeForeground": "#8a8a8a",
      // 括号匹配 — 微金色
      "editorBracketMatch.background": "#e0a84c15",
      "editorBracketMatch.border": "#e0a84c40",
      // 滚动条
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#44444425",
      "scrollbarSlider.hoverBackground": "#44444450",
      "scrollbarSlider.activeBackground": "#44444470",
      // 搜索高亮 — 金色
      "editor.findMatchBackground": "#e0a84c33",
      "editor.findMatchHighlightBackground": "#e0a84c1a",
      // 概览标尺
      "editorOverviewRuler.border": "#00000000",
      // Widget
      "editorWidget.background": "#1c1c1e",
      "editorWidget.border": "#2a2a2c",
    },
  });
}



/** 生成 Slug（中文转拼音首字母 + 英文保留） */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s]+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/[\u4e00-\u9fa5]+/g, (m) => m.split("").map((c) => c.charCodeAt(0).toString(36)).join(""))
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** 本地草稿存储 */
const DRAFT_KEY = "monolith_editor_draft";
function saveDraft(slug: string, data: Record<string, unknown>) {
  try { localStorage.setItem(`${DRAFT_KEY}_${slug || "new"}`, JSON.stringify(data)); } catch { /* 忽略 */ }
}
function loadDraft(slug: string) {
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY}_${slug || "new"}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearDraft(slug: string) {
  try { localStorage.removeItem(`${DRAFT_KEY}_${slug || "new"}`); } catch { /* 忽略 */ }
}

export function AdminEditor() {
  const params = useParams<{ slug?: string }>();
  const [, setLocation] = useLocation();
  const isEdit = !!params.slug;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MonacoTypes.editor.IStandaloneCodeEditor | null>(null);

  const [form, setForm] = useState({
    slug: "",
    title: "",
    content: "",
    excerpt: "",
    coverColor: "from-zinc-500/20 to-slate-500/20",
    coverImage: "",
    tags: "",
    published: true,
    pinned: false,
    publishAt: "",
    seriesSlug: "",
    seriesOrder: 0,
    category: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" as "" | "success" | "error" });
  const [showPreview, setShowPreview] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [metaCollapsed, setMetaCollapsed] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!isEdit);
  const [lastSaved, setLastSaved] = useState<string>("");

  const [saveVersion, setSaveVersion] = useState(false);
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [syncScroll, setSyncScroll] = useState(true);
  const syncScrollRef = useRef(true);
  const previewRef = useRef<HTMLDivElement>(null);

  // 保持 ref 与 state 同步（避免 onMount 闭包陷阱）
  useEffect(() => { syncScrollRef.current = syncScroll; }, [syncScroll]);

  useEffect(() => {
    if (isEdit && params.slug) {
      fetchPostVersions(params.slug).then(setVersions).catch(() => {});
    }
  }, [isEdit, params.slug, lastSaved]);

  useEffect(() => {
    document.title = isEdit ? "编辑文章 | Monolith" : "新建文章 | Monolith";

    if (isEdit && params.slug) {
      fetchPost(params.slug).then((post) => {
        setForm({
          slug: post.slug,
          title: post.title,
          content: post.content,
          excerpt: post.excerpt || "",
          coverColor: post.coverColor || "",
          coverImage: post.coverImage || "",
          tags: post.tags.join(", "),
          published: post.published,
          pinned: post.pinned,
          publishAt: post.publishAt ? new Date(new Date(post.publishAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
          seriesSlug: post.seriesSlug || "",
          seriesOrder: post.seriesOrder ?? 0,
          category: post.category || "",
        });
        setAutoSlug(false);
      });
    } else {
      // 新建时尝试恢复草稿
      const draft = loadDraft("new");
      if (draft && draft.content) {
        setForm((prev) => ({ ...prev, ...draft }));
        showMsg("已恢复本地草稿", "success");
      }
    }
  }, [isEdit, params.slug, setLocation]);

  useEffect(() => {
    const chars = form.content.replace(/\s/g, "").length;
    setWordCount(chars);
  }, [form.content]);

  // 自动保存草稿（每 10 秒）
  useEffect(() => {
    const timer = setInterval(() => {
      if (form.content.trim()) {
        saveDraft(params.slug || "", form);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [form, params.slug]);

  // Ctrl+S 保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [form]);

  const showMsg = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  }, []);

  const handleSave = async () => {
    if (!form.slug || !form.title) {
      showMsg("请填写 Slug 和标题", "error");
      return;
    }

    setSaving(true);
    try {
      const tagsList = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        slug: form.slug,
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        coverColor: form.coverColor,
        coverImage: form.coverImage,
        published: form.published,
        tags: tagsList,
        pinned: form.pinned,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
        seriesSlug: form.seriesSlug || null,
        seriesOrder: form.seriesOrder,
        category: form.category,
      };

      if (isEdit && params.slug) {
        await updatePost(params.slug, { ...payload, saveVersion });
        setLastSaved(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
        showMsg("已保存" + (saveVersion ? "并创建了版本快照" : ""), "success");
        clearDraft(params.slug);
        if (saveVersion) setSaveVersion(false);
      } else {
        await createPost(payload);
        showMsg("已创建，即将跳转...", "success");
        clearDraft("new");
        setTimeout(() => setLocation("/admin"), 1200);
      }
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : "操作失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (version: PostVersion) => {
    if (!params.slug) return;
    if (!confirm(`确定要恢复到 ${new Date(version.createdAt).toLocaleString()} 的版本吗？当前未保存的修改将丢失。`)) return;
    setRestoring(true);
    try {
      const { post } = await restorePostVersion(params.slug, version.id);
      setForm((prev) => ({
        ...prev,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || "",
      }));
      const editor = editorRef.current;
      if (editor) {
        const model = editor.getModel();
        if (model) model.setValue(post.content);
      }
      showMsg("版本已恢复", "success");
      setLastSaved(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      setShowVersions(false);
    } catch (err: any) {
      showMsg(err.message || "恢复失败", "error");
    } finally {
      setRestoring(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const placeholder = `![上传中... ${file.name}](uploading)`;
    insertText(placeholder);
    try {
      const result = await uploadImage(file);
      // 替换占位符为实际 URL
      const editor = editorRef.current;
      if (editor) {
        const model = editor.getModel();
        if (model) {
          const fullText = model.getValue();
          const idx = fullText.indexOf(placeholder);
          if (idx !== -1) {
            const before = fullText.substring(0, idx);
            const startLine = (before.match(/\n/g) || []).length + 1;
            const startCol = before.length - before.lastIndexOf("\n");
            const endCol = startCol + placeholder.length;
            editor.executeEdits("paste-image", [{
              range: {
                startLineNumber: startLine,
                startColumn: startCol,
                endLineNumber: startLine,
                endColumn: endCol,
              },
              text: `![${file.name}](${result.url})`,
            }]);
          } else {
            // 占位符未找到（可能被手动删除），直接插入
            insertText(`![${file.name}](${result.url})`);
          }
        }
      } else {
        // fallback：直接替换 form 中的内容
        setForm((prev) => ({
          ...prev,
          content: prev.content.replace(placeholder, `![${file.name}](${result.url})`),
        }));
      }
      showMsg("图片已上传", "success");
    } catch {
      // 上传失败，移除占位符
      const editor = editorRef.current;
      if (editor) {
        const model = editor.getModel();
        if (model) {
          const fullText = model.getValue();
          const newText = fullText.replace(placeholder, "");
          model.setValue(newText);
        }
      } else {
        setForm((prev) => ({ ...prev, content: prev.content.replace(placeholder, "") }));
      }
      showMsg("图片上传失败", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleImageUpload(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) handleImageUpload(file);
      }
    }
  }, []);

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // 标题变化时自动更新 Slug
      if (key === "title" && autoSlug && typeof value === "string") {
        next.slug = generateSlug(value);
      }
      return next;
    });
  };

  /** 在 Monaco 编辑器中插入文本 */
  const insertText = useCallback((text: string) => {
    const editor = editorRef.current;
    if (editor) {
      const selection = editor.getSelection();
      const position = selection ? selection.getStartPosition() : editor.getPosition();
      if (position) {
        editor.executeEdits("toolbar", [{
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: text,
        }]);
        editor.focus();
      }
    } else {
      setForm((prev) => ({ ...prev, content: prev.content + text }));
    }
  }, []);

  /** 在 Monaco 中包裹选中文本 */
  const wrapSelection = useCallback((before: string, after: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getModel()?.getValueInRange(selection) || "";
    const replacement = selectedText ? `${before}${selectedText}${after}` : `${before}文本${after}`;

    editor.executeEdits("toolbar", [{
      range: selection,
      text: replacement,
    }]);
    editor.focus();
  }, []);

  /** 在行首插入文本 */
  const insertLinePrefix = useCallback((prefix: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const position = editor.getPosition();
    if (!position) return;

    editor.executeEdits("toolbar", [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: 1,
      },
      text: prefix,
    }]);
    editor.focus();
  }, []);

  const toolbarActions = [
    { icon: Bold, label: "粗体", shortcut: "Ctrl+B", action: () => wrapSelection("**", "**") },
    { icon: Italic, label: "斜体", shortcut: "Ctrl+I", action: () => wrapSelection("*", "*") },
    { icon: null, label: "sep1" },
    { icon: Heading2, label: "二级标题", action: () => insertLinePrefix("## ") },
    { icon: Heading3, label: "三级标题", action: () => insertLinePrefix("### ") },
    { icon: null, label: "sep2" },
    { icon: Link2, label: "链接", action: () => insertText("[链接文本](https://example.com)") },
    { icon: Code, label: "行内代码", action: () => wrapSelection("`", "`") },
    { icon: FileCode, label: "代码块", action: () => insertText("\n```typescript\n// 代码\n```\n") },
    { icon: Quote, label: "引用", action: () => insertLinePrefix("> ") },
    { icon: null, label: "sep3" },
    { icon: List, label: "无序列表", action: () => insertLinePrefix("- ") },
    { icon: ListOrdered, label: "有序列表", action: () => insertLinePrefix("1. ") },
    { icon: CheckSquare, label: "任务列表", action: () => insertLinePrefix("- [ ] ") },
    { icon: Table, label: "表格", action: () => insertText("\n| 列一 | 列二 | 列三 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n") },
    { icon: Minus, label: "分隔线", action: () => insertText("\n---\n") },
  ];

  const colorPresets = [
    { label: "钛金灰", value: "from-zinc-500/20 to-slate-500/20" },
    { label: "石板墨", value: "from-slate-600/20 to-gray-700/20" },
    { label: "冷白", value: "from-neutral-100/16 to-zinc-500/16" },
    { label: "低饱和青", value: "from-cyan-500/12 to-slate-500/12" },
    { label: "琥珀状态", value: "from-amber-500/14 to-zinc-500/14" },
    { label: "红色状态", value: "from-red-500/12 to-zinc-500/12" },
  ];

  return (
    <div
      className="mx-auto flex h-[calc(100vh-56px)] w-full max-w-[1280px] flex-col px-[12px] py-[16px] sm:px-[18px] sm:py-[20px]"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onPaste={handlePaste}
    >
      {/* ─── 顶栏 ─── */}
      <div className="mb-[12px] flex shrink-0 flex-col gap-[12px] rounded-md border border-border/18 bg-background/32 p-[12px] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-[10px]">
          <button
            type="button"
            onClick={() => setLocation("/admin")}
            className="inline-flex min-h-[36px] items-center gap-[6px] rounded-md border border-border/20 bg-card/10 px-[10px] text-[12px] text-muted-foreground/85 transition-colors hover:bg-card/20 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-[12px] w-[12px]" />返回
          </button>
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-muted-foreground/42">{isEdit ? "EDITING" : "NEW DRAFT"}</p>
            <h1 className="truncate font-heading text-[17px] font-semibold tracking-[-0.02em] text-foreground/90">
              {form.title || "未命名文章"}
            </h1>
          </div>
          <span className="rounded-md border border-border/15 bg-background/35 px-[8px] py-[4px] font-mono text-[11px] text-muted-foreground/70">{wordCount} 字</span>
          {lastSaved && (
            <>
              <span className="hidden text-[12px] text-muted-foreground/30 sm:inline">/</span>
              <span className="text-[11px] text-muted-foreground/62">上次保存 {lastSaved}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-[6px]">
          {message.text && (
            <span className={`rounded-md px-[10px] py-[6px] text-[12px] transition-all ${
              message.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`}>
              {message.type === "success" ? "✓" : "✕"} {message.text}
            </span>
          )}
          <button onClick={() => setZenMode(!zenMode)} title="专注模式" className="h-[36px] px-[10px] rounded-md text-muted-foreground/85 transition-colors hover:bg-accent/20 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {zenMode ? <Minimize2 className="h-[14px] w-[14px]" /> : <Maximize2 className="h-[14px] w-[14px]" />}
          </button>
          <label className="flex min-h-[36px] cursor-pointer select-none items-center gap-[6px] rounded-md px-[8px] text-[12px] text-muted-foreground/80 transition-colors hover:bg-accent/16 hover:text-foreground">
            <input type="checkbox" checked={form.published} onChange={(e) => updateField("published", e.target.checked)} className="rounded accent-foreground" />
            发布
          </label>
          <label className="flex min-h-[36px] cursor-pointer select-none items-center gap-[6px] rounded-md px-[8px] text-[12px] text-amber-500/65 transition-colors hover:bg-amber-500/8 hover:text-amber-500/85">
            <input type="checkbox" checked={form.pinned} onChange={(e) => updateField("pinned", e.target.checked)} className="rounded accent-amber-500" />
            置顶
          </label>
          {isEdit && (
            <>
              <div className="h-[14px] w-[1px] bg-border/20 mx-[2px]"></div>
              <button onClick={() => setShowVersions(true)} title="历史版本" className="relative h-[36px] px-[10px] rounded-md text-muted-foreground/85 transition-colors hover:bg-accent/20 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <History className="h-[14px] w-[14px]" />
                {versions.length > 0 && <span className="absolute right-[6px] top-[6px] h-[4px] w-[4px] rounded-full bg-foreground/70"></span>}
              </button>
              <label title="保存时生成一份文章内容的历史快照" className="mr-[4px] flex min-h-[36px] cursor-pointer select-none items-center gap-[4px] rounded-md px-[8px] text-[12px] text-muted-foreground/80 transition-colors hover:bg-accent/16 hover:text-foreground">
                <input type="checkbox" checked={saveVersion} onChange={(e) => setSaveVersion(e.target.checked)} className="rounded accent-foreground" />
                建快照
              </label>
            </>
          )}
          <button onClick={handleSave} disabled={saving} className="inline-flex h-[36px] items-center gap-[4px] rounded-md bg-foreground px-[14px] text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Save className="h-[12px] w-[12px]" />{saving ? "保存中..." : "保存"}
          </button>
          {isEdit && (
            <button
              onClick={async () => {
                if (!params.slug) return;
                try {
                  // 先保存当前修改，确保后端基于最新内容操作
                  showMsg("正在保存并转换外链图片...", "success");
                  await handleSave();
                  const result = await localizePostImages(params.slug);
                  if (result.replaced > 0) {
                    showMsg(`已转换 ${result.replaced} 张图片${result.failed ? `，${result.failed} 张失败` : ""}`, "success");
                    // 重新加载文章内容到编辑器
                    const fresh = await fetchPost(params.slug);
                    if (fresh) updateField("content", fresh.content);
                  } else {
                    showMsg(result.message || "未发现外链图片", "success");
                  }
                } catch { showMsg("外链转本地失败", "error"); }
              }}
              title="将文章中的外链图片下载到本地存储"
              className="inline-flex h-[36px] items-center gap-[4px] rounded-md px-[10px] text-[12px] text-muted-foreground/80 transition-colors hover:bg-accent/15 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ImageDown className="h-[12px] w-[12px]" />外链转本地
            </button>
          )}
        </div>
      </div>

      {/* ─── 元信息面板（可折叠） ─── */}
      {!zenMode && (
        <div className="mb-[10px] shrink-0 overflow-hidden rounded-md border border-border/20 bg-background/28 transition-all">
          <button
            onClick={() => setMetaCollapsed(!metaCollapsed)}
            className="flex min-h-[40px] w-full items-center justify-between px-[16px] py-[8px] text-[11px] text-muted-foreground/85 transition-colors hover:bg-accent/12 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <span className="font-mono uppercase tracking-normal">
              {form.title || "文章元信息"}
            </span>
            {metaCollapsed ? <ChevronDown className="h-[12px] w-[12px]" /> : <ChevronUp className="h-[12px] w-[12px]" />}
          </button>

          {!metaCollapsed && (
            <div className="border-t border-border/12 px-[16px] pb-[16px] pt-[12px]">
              <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-3 lg:grid-cols-5">
                <div>
                  <label className="mb-[4px] block text-[10px] uppercase tracking-normal text-muted-foreground/68">Slug {autoSlug && <span className="text-muted-foreground/45">（自动）</span>}</label>
                  <input
                    value={form.slug}
                    onChange={(e) => { updateField("slug", e.target.value); setAutoSlug(false); }}
                    placeholder="my-article" disabled={isEdit}
                    className="h-[34px] w-full rounded-md border border-border/25 bg-background/28 px-[10px] font-mono text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/25 disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="mb-[4px] block text-[10px] uppercase tracking-normal text-muted-foreground/68">标签</label>
                  <input
                    value={form.tags} onChange={(e) => updateField("tags", e.target.value)}
                    placeholder="Next.js, 前端"
                    className="h-[34px] w-full rounded-md border border-border/25 bg-background/28 px-[10px] text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/25"
                  />
                </div>
                <div>
                  <label className="mb-[4px] block text-[10px] uppercase tracking-normal text-muted-foreground/68">定时发布</label>
                  <input
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(e) => updateField("publishAt", e.target.value)}
                    className="h-[34px] w-full rounded-md border border-border/25 bg-background/28 px-[10px] text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/25 dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="mb-[4px] block text-[10px] uppercase tracking-normal text-muted-foreground/68">封面色</label>
                  <div className="flex h-[34px] items-center gap-[4px]">
                    {colorPresets.map((preset) => (
                      <button key={preset.value} onClick={() => updateField("coverColor", preset.value)} title={preset.label}
                        className={`h-[22px] w-[22px] rounded-[3px] bg-gradient-to-r ${preset.value} border transition-all ${
                          form.coverColor === preset.value ? "border-foreground/55 scale-105" : "border-border/15 opacity-55 hover:opacity-90"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-[4px] block text-[10px] uppercase tracking-normal text-muted-foreground/68">封面图（可选 · 留空则取正文首图）</label>
                  <div className="flex items-center gap-[8px]">
                    <input
                      value={form.coverImage}
                      onChange={(e) => updateField("coverImage", e.target.value)}
                      placeholder="https://... 或上传后自动填充"
                      className="h-[34px] flex-1 rounded-md border border-border/25 bg-background/28 px-[10px] text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/25"
                    />
                    <label className="inline-flex h-[34px] cursor-pointer items-center gap-[4px] rounded-md border border-border/25 bg-background/28 px-[10px] text-[12px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground">
                      <Upload className="h-[12px] w-[12px]" />
                      <span>{uploading ? "上传中…" : "上传"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          try {
                            const result = await uploadImage(file);
                            updateField("coverImage", result.url);
                            showMsg("封面图已上传", "success");
                          } catch {
                            showMsg("封面图上传失败", "error");
                          } finally {
                            setUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                    {form.coverImage && (
                      <div className="h-[30px] w-[48px] shrink-0 overflow-hidden rounded-md border border-border/25">
                        <img src={form.coverImage} alt="封面预览" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-[4px] block text-[10px] uppercase tracking-normal text-muted-foreground/68">系列 Slug</label>
                  <input
                    value={form.seriesSlug}
                    onChange={(e) => updateField("seriesSlug", e.target.value)}
                    placeholder="如 react-tutorial"
                    className="h-[34px] w-full rounded-md border border-border/25 bg-background/28 px-[10px] font-mono text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/25"
                  />
                </div>
                <div>
                  <label className="mb-[4px] block text-[10px] uppercase tracking-normal text-muted-foreground/68">分类</label>
                  <input
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    placeholder="如 前端、后端、DevOps"
                    className="h-[34px] w-full rounded-md border border-border/25 bg-background/28 px-[10px] text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/25"
                  />
                </div>
              </div>
              <input
                value={form.title} onChange={(e) => updateField("title", e.target.value)}
                placeholder="文章标题"
                className="mt-[14px] w-full border-none bg-transparent font-heading text-[24px] font-semibold tracking-[-0.03em] text-foreground outline-none placeholder:text-muted-foreground/45"
              />
              <textarea
                value={form.excerpt} onChange={(e) => updateField("excerpt", e.target.value)}
                placeholder="文章摘要（可选，用于列表展示）" rows={1}
                className="mt-[6px] w-full resize-none bg-transparent text-[13px] leading-[1.7] text-muted-foreground/85 outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          )}
        </div>
      )}

      {/* ─── 编辑器 + 预览 ─── */}
      <div className={`grid min-h-0 flex-1 ${showPreview ? "grid-cols-1 lg:grid-cols-2 lg:gap-[1px]" : "grid-cols-1"} overflow-hidden rounded-md border border-border/22 bg-background/35`}>
        {/* 左侧 Monaco 编辑器 */}
        <div className="flex flex-col min-h-0">
          {/* 工具栏 */}
          <div className="flex shrink-0 items-center justify-between overflow-x-auto border-b border-border/15 bg-card/10 px-[8px] py-[4px]">
            <div className="flex items-center gap-[1px] shrink-0">
              {toolbarActions.map((item) => {
                if (!item.icon) return <div key={item.label} className="w-px h-[16px] bg-border/15 mx-[4px]" />;
                const Icon = item.icon;
                return (
                  <button key={item.label} onClick={item.action} title={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ""}`}
                    className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-[4px] text-muted-foreground/85 transition-colors hover:bg-accent/20 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Icon className="h-[14px] w-[14px]" />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-[2px]">
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="inline-flex h-[28px] items-center gap-[4px] rounded-[4px] px-[8px] text-[10px] text-muted-foreground/85 transition-colors hover:bg-accent/20 hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {uploading ? <Upload className="h-[10px] w-[10px] animate-pulse" /> : <Image className="h-[10px] w-[10px]" />}
                {uploading ? "上传中" : "插图"}
              </button>
              <div className="w-px h-[14px] bg-border/15 mx-[4px]" />
              <button
                onClick={() => setShowPreview(!showPreview)}
                title={showPreview ? "关闭预览" : "打开预览"}
                className={`inline-flex h-[28px] items-center gap-[4px] rounded-[4px] px-[8px] text-[10px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${showPreview ? "bg-foreground/[0.07] text-foreground/78 hover:bg-foreground/[0.10]" : "text-muted-foreground/60 hover:bg-accent/20 hover:text-foreground"}`}
              >
                {showPreview ? <Eye className="h-[10px] w-[10px]" /> : <EyeOff className="h-[10px] w-[10px]" />}
                {showPreview ? "预览" : "预览"}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              defaultLanguage="markdown"
              value={form.content}
              onChange={(val) => updateField("content", val || "")}
              theme="monolith-dark"
              beforeMount={handleEditorWillMount}
              onMount={(editor) => {
                editorRef.current = editor;
                // ── 同步滚动：编辑器 → 预览 ──
                editor.onDidScrollChange(() => {
                  if (!syncScrollRef.current || !previewRef.current) return;
                  const scrollTop = editor.getScrollTop();
                  const scrollHeight = editor.getScrollHeight();
                  const clientHeight = editor.getLayoutInfo().height;
                  const maxScroll = scrollHeight - clientHeight;
                  if (maxScroll <= 0) return;
                  const ratio = scrollTop / maxScroll;
                  const previewEl = previewRef.current;
                  const previewMax = previewEl.scrollHeight - previewEl.clientHeight;
                  previewEl.scrollTop = ratio * previewMax;
                });
                // 监听 Monaco 编辑器的 paste 事件（处理粘贴图片）
                const domNode = editor.getDomNode();
                if (domNode) {
                  domNode.addEventListener("paste", (e: Event) => {
                    const ce = e as ClipboardEvent;
                    const items = ce.clipboardData?.items;
                    if (!items) return;
                    for (const item of items) {
                      if (item.type.startsWith("image/")) {
                        ce.preventDefault();
                        ce.stopPropagation();
                        const file = item.getAsFile();
                        if (file) handleImageUpload(file);
                        return;
                      }
                    }
                  });
                  // 拖拽上传
                  domNode.addEventListener("drop", (e: Event) => {
                    const de = e as DragEvent;
                    de.preventDefault();
                    const file = de.dataTransfer?.files[0];
                    if (file?.type.startsWith("image/")) handleImageUpload(file);
                  });
                  domNode.addEventListener("dragover", (e: Event) => { e.preventDefault(); });
                }
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 24,
                fontFamily: "'Cascadia Code', 'Fira Code', ui-monospace, monospace",
                wordWrap: "on",
                padding: { top: 12, bottom: 12 },
                scrollBeyondLastLine: false,
                renderLineHighlight: "none",
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
                guides: { indentation: false },
                lineNumbers: "off",
                folding: false,
                glyphMargin: false,
                lineDecorationsWidth: 16,
                lineNumbersMinChars: 0,
                tabSize: 2,
                suggest: { showWords: false },
                quickSuggestions: false,
              }}
            />
          </div>
        </div>

        {/* 右侧实时预览 */}
        {showPreview && (
          <div className="flex flex-col min-h-0 border-l border-border/15">
            <div className="flex items-center justify-between px-[12px] py-[4px] border-b border-border/15 bg-card/10 shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-normal text-muted-foreground/72">预览</span>
              <div className="flex items-center gap-[2px]">
                <button
                  onClick={() => setSyncScroll(!syncScroll)}
                  title={syncScroll ? "已开启同步滚动（点击关闭）" : "已关闭同步滚动（点击开启）"}
                  className={`inline-flex h-[28px] items-center gap-[4px] rounded-[4px] px-[8px] text-[10px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    syncScroll
                      ? "bg-foreground/[0.07] text-foreground/75 hover:bg-foreground/[0.10]"
                      : "text-muted-foreground/35 hover:bg-accent/10 hover:text-muted-foreground/60"
                  }`}
                >
                  <ArrowDownUp className="h-[12px] w-[12px]" />
                  {syncScroll ? "同步" : "独立"}
                </button>
              </div>
            </div>
            <div ref={previewRef} className="flex-1 min-h-0 overflow-y-auto p-[24px]">
              {form.title && (
                <h1 className="mb-[16px] font-heading text-[24px] font-semibold tracking-[-0.03em]">{form.title}</h1>
              )}
              <div className="prose-monolith" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }} />
            </div>
          </div>
        )}
      </div>

      {/* ─── 历史版本弹窗 ─── */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-[20px]">
          <div className="flex max-h-[85vh] w-full max-w-[560px] flex-col rounded-md border border-border/20 bg-card shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border/10 px-[20px] py-[16px]">
              <h3 className="flex items-center gap-[8px] text-[16px] font-semibold">
                <History className="h-[16px] w-[16px] text-foreground/72" /> 文章历史版本 ({versions.length})
              </h3>
              <button disabled={restoring} onClick={() => setShowVersions(false)} className="rounded-md text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
            
            <div className="p-[20px] flex-1 overflow-y-auto min-h-0 space-y-[10px]">
              {versions.length === 0 ? (
                <div className="text-center py-[40px] text-muted-foreground/60 text-[13px]">
                  暂无历史版本快照。<br/>请在保存文章前勾选「建快照」。
                </div>
              ) : (
                versions.map((v, i) => (
                  <div key={v.id} className="group flex items-center justify-between rounded-md border border-border/15 bg-card/5 p-[14px] transition-all hover:border-border/35 hover:bg-foreground/[0.035]">
                    <div>
                      <div className="text-[14px] font-medium text-foreground/90 mb-[4px]">{new Date(v.createdAt).toLocaleString()}</div>
                      <div className="text-[12px] text-muted-foreground/50">
                        {v.content.length} 字符
                        {i === 0 && <span className="ml-[8px] text-[10px] bg-emerald-500/10 text-emerald-400 px-[6px] py-[2px] rounded-[4px]">最新快照</span>}
                      </div>
                    </div>
                    <button
                      disabled={restoring}
                      onClick={() => handleRestore(v)}
                      className="rounded-md bg-foreground px-[14px] py-[6px] text-[12px] font-medium text-background opacity-100 transition-all hover:opacity-90 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      恢复此版本
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
