import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import {
  fetchMedia, deleteMedia, uploadImage,
  localizeAllImages,
  type MediaItem,
} from "@/lib/api";
import {
  Trash2, Image as ImageIcon, Grid, List, Upload,
  Copy, Check, X, Eye, ImageDown,
} from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isImageFile(name: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif)$/i.test(name);
}

type ViewMode = "grid" | "list";

export function AdminMedia() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localizing, setLocalizing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    document.title = "媒体资产 | Monolith";
    loadMedia();
  }, []);

  const loadMedia = useCallback(() => {
    setLoading(true);
    fetchMedia().then(setMedia).finally(() => setLoading(false));
  }, []);

  const handleUpload = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadImage(file);
      }
      loadMedia();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleUpload(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 个文件？此操作不可撤销。`)) return;
    setDeleting(true);
    try {
      for (const key of selected) {
        await deleteMedia(key);
      }
      setMedia((prev) => prev.filter((m) => !selected.has(m.key)));
      setSelected(new Set());
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async (key: string) => {
    if (!confirm("确定删除此文件？")) return;
    setDeleting(true);
    try {
      await deleteMedia(key);
      setMedia((prev) => prev.filter((m) => m.key !== key));
      setSelected((prev) => { const s = new Set(prev); s.delete(key); return s; });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  const selectAll = () => {
    if (selected.size === media.length) setSelected(new Set());
    else setSelected(new Set(media.map((m) => m.key)));
  };

  const copyUrl = (url: string) => {
    const full = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(full);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  const totalSize = media.reduce((acc, m) => acc + m.size, 0);

  return (
    <div className="mx-auto w-full max-w-[960px] py-[32px]">
      {/* ─── 顶栏 ─── */}
      <div className="mb-[24px] flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">媒体资产</h1>
          <p className="mt-[3px] text-[13px] text-muted-foreground/40">
            {media.length} 个文件 · 共 {formatSize(totalSize)}
          </p>
        </div>
        <div className="flex items-center gap-[6px]">
          {selected.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="inline-flex items-center gap-[5px] h-[34px] px-[14px] rounded-md border border-red-400/30 text-red-400 text-[12px] font-medium hover:bg-red-400/10 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-[13px] w-[13px]" />删除 ({selected.size})
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-[5px] h-[34px] px-[14px] rounded-md bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Upload className="h-[13px] w-[13px]" />{uploading ? "上传中..." : "上传"}
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileInput} className="hidden" />
          <div className="flex rounded-md border border-border/30 overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={`p-[8px] transition-colors ${viewMode === "grid" ? "bg-card/30 text-foreground" : "text-muted-foreground/40 hover:text-foreground"}`} title="网格视图">
              <Grid className="h-[14px] w-[14px]" />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-[8px] transition-colors ${viewMode === "list" ? "bg-card/30 text-foreground" : "text-muted-foreground/40 hover:text-foreground"}`} title="列表视图">
              <List className="h-[14px] w-[14px]" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 拖拽上传区域 ─── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-[20px] rounded-lg border-2 border-dashed py-[32px] text-center transition-all ${
          dragOver
            ? "border-foreground/35 bg-foreground/[0.04]"
            : "border-border/25 hover:border-border/40"
        }`}
      >
        <Upload className={`mx-auto mb-[8px] h-[24px] w-[24px] ${dragOver ? "text-foreground/72" : "text-muted-foreground/20"}`} />
        <p className="text-[13px] text-muted-foreground/40">
          {dragOver ? "松开以上传" : "拖拽文件到此处，或"}
          {!dragOver && (
            <button onClick={() => fileInputRef.current?.click()} className="ml-[4px] text-foreground/60 hover:text-foreground underline underline-offset-2">
              选择文件
            </button>
          )}
        </p>
      </div>

      {/* ─── 外链图片转本地 ─── */}
      <div className="mb-[16px] rounded-lg border border-border/25 bg-card/10 p-[14px] flex items-center justify-between">
        <div>
          <p className="text-[13px] text-foreground flex items-center gap-[5px]">
            <ImageDown className="h-[13px] w-[13px] text-muted-foreground/50" />外链图片转本地
          </p>
          <p className="text-[11px] text-muted-foreground/35 mt-[1px] ml-[18px]">扫描所有文章，将外链图片下载到对象存储并替换 URL</p>
        </div>
        <button onClick={async () => {
          if (!confirm("确定扫描所有文章并转换外链图片？\n这可能需要较长时间。")) return;
          setLocalizing(true);
          setMsg(null);
          try {
            const result = await localizeAllImages();
            if (result.totalReplaced > 0) {
              setMsg({ text: `已转换 ${result.totalReplaced} 张图片（涉及 ${result.posts.length} 篇文章）${result.totalFailed ? `，${result.totalFailed} 张失败` : ""}`, type: "success" });
              loadMedia();
            } else {
              setMsg({ text: "所有文章均无外链图片", type: "success" });
            }
          } catch { setMsg({ text: "批量转换失败", type: "error" }); }
          setLocalizing(false);
        }} disabled={localizing}
          className="inline-flex items-center gap-[5px] h-[32px] px-[12px] rounded-md text-[12px] text-muted-foreground border border-border/25 hover:text-foreground hover:border-foreground/20 disabled:opacity-50 transition-colors shrink-0"
        >
          {localizing ? "扫描中..." : "批量转换"}
        </button>
      </div>
      {msg && (
        <div className={`mb-[12px] rounded-md px-[12px] py-[8px] text-[12px] ${
          msg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {msg.text}
        </div>
      )}

      {/* ─── 全选 ─── */}
      {media.length > 0 && (
        <div className="mb-[8px] flex items-center justify-between">
          <button onClick={selectAll} className="text-[12px] text-muted-foreground/40 hover:text-foreground transition-colors">
            {selected.size === media.length ? "取消全选" : "全选"}
          </button>
          <span className="text-[11px] text-muted-foreground/25">{media.length} 个文件</span>
        </div>
      )}

      {/* ─── 文件列表 ─── */}
      {loading ? (
        <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-[10px]" : "space-y-[4px]"}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`animate-pulse rounded-lg bg-card/15 ${viewMode === "grid" ? "aspect-square" : "h-[56px]"}`} />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/25 py-[48px] text-center">
          <ImageIcon className="mx-auto mb-[10px] h-[20px] w-[20px] text-muted-foreground/20" />
          <p className="text-[13px] text-muted-foreground/40">还没有上传任何文件</p>
        </div>
      ) : viewMode === "grid" ? (
        /* ─── 网格视图 ─── */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-[10px]">
          {media.map((item) => (
            <div
              key={item.key}
              className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
                selected.has(item.key)
                  ? "border-foreground/42 ring-1 ring-foreground/20"
                  : "border-border/25 hover:border-border/40"
              }`}
              onClick={() => toggleSelect(item.key)}
            >
              {/* 缩略图 */}
              <div className="aspect-square bg-card/10 flex items-center justify-center overflow-hidden">
                {isImageFile(item.name) ? (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <ImageIcon className="h-[32px] w-[32px] text-muted-foreground/15" />
                )}
              </div>

              {/* 选中指示器 */}
              <div className={`absolute top-[6px] left-[6px] h-[20px] w-[20px] rounded-full border-2 flex items-center justify-center transition-all ${
                selected.has(item.key)
                  ? "bg-foreground border-foreground"
                  : "border-white/30 bg-black/20 opacity-0 group-hover:opacity-100"
              }`}>
                {selected.has(item.key) && <Check className="h-[12px] w-[12px] text-background" />}
              </div>

              {/* 操作覆盖层 */}
              <div className="absolute top-[6px] right-[6px] flex gap-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setPreview(item); }}
                  className="p-[5px] rounded-md bg-black/40 text-white/80 hover:bg-black/60 transition-colors"
                >
                  <Eye className="h-[12px] w-[12px]" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyUrl(item.url); }}
                  className="p-[5px] rounded-md bg-black/40 text-white/80 hover:bg-black/60 transition-colors"
                >
                  {copied === item.url ? <Check className="h-[12px] w-[12px] text-green-400" /> : <Copy className="h-[12px] w-[12px]" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSingle(item.key); }}
                  className="p-[5px] rounded-md bg-black/40 text-white/80 hover:bg-red-500/80 transition-colors"
                >
                  <Trash2 className="h-[12px] w-[12px]" />
                </button>
              </div>

              {/* 文件信息 */}
              <div className="px-[8px] py-[6px] bg-card/20">
                <p className="text-[11px] text-foreground/70 truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground/30">{formatSize(item.size)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── 列表视图 ─── */
        <div className="rounded-lg border border-border/25 overflow-hidden">
          {media.map((item, i) => (
            <div
              key={item.key}
              className={`group flex items-center gap-[12px] px-[16px] py-[10px] ${i < media.length - 1 ? "border-b border-border/12" : ""} hover:bg-card/15 transition-colors cursor-pointer ${
                selected.has(item.key) ? "bg-foreground/[0.04]" : ""
              }`}
              onClick={() => toggleSelect(item.key)}
            >
              {/* 选中框 */}
              <div className={`h-[18px] w-[18px] rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                selected.has(item.key)
                  ? "bg-foreground border-foreground"
                  : "border-border/30"
              }`}>
                {selected.has(item.key) && <Check className="h-[11px] w-[11px] text-background" />}
              </div>

              {/* 缩略图 */}
              <div className="h-[40px] w-[40px] rounded-md bg-card/20 overflow-hidden shrink-0 flex items-center justify-center">
                {isImageFile(item.name) ? (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <ImageIcon className="h-[16px] w-[16px] text-muted-foreground/20" />
                )}
              </div>

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground truncate">{item.name}</p>
                <p className="text-[11px] text-muted-foreground/30">{formatSize(item.size)} · {formatDate(item.uploaded)}</p>
              </div>

              {/* 操作 */}
              <div className="flex items-center gap-[1px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setPreview(item); }}
                  className="p-[7px] rounded-md text-muted-foreground/30 hover:text-foreground hover:bg-accent/15 transition-colors" title="预览"
                >
                  <Eye className="h-[13px] w-[13px]" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyUrl(item.url); }}
                  className="p-[7px] rounded-md text-muted-foreground/30 hover:text-foreground hover:bg-accent/15 transition-colors" title="复制链接"
                >
                  {copied === item.url ? <Check className="h-[13px] w-[13px] text-green-400" /> : <Copy className="h-[13px] w-[13px]" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSingle(item.key); }}
                  className="p-[7px] rounded-md text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/8 transition-colors" title="删除"
                >
                  <Trash2 className="h-[13px] w-[13px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── 图片预览灯箱 ─── */}
      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-[12px] -right-[12px] z-10 p-[6px] rounded-full bg-card border border-border/30 text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-[14px] w-[14px]" />
            </button>
            {isImageFile(preview.name) ? (
              <img
                src={preview.url}
                alt={preview.name}
                className="max-w-[90vw] max-h-[80vh] rounded-lg object-contain"
              />
            ) : (
              <div className="w-[300px] h-[200px] rounded-lg bg-card/30 flex items-center justify-center">
                <ImageIcon className="h-[48px] w-[48px] text-muted-foreground/20" />
              </div>
            )}
            <div className="mt-[12px] flex items-center justify-between">
              <div>
                <p className="text-[14px] text-foreground">{preview.name}</p>
                <p className="text-[12px] text-muted-foreground/40">{formatSize(preview.size)} · {formatDate(preview.uploaded)}</p>
              </div>
              <div className="flex gap-[4px]">
                <button
                  onClick={() => copyUrl(preview.url)}
                  className="inline-flex items-center gap-[4px] h-[30px] px-[10px] rounded-md border border-border/30 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied === preview.url ? <Check className="h-[12px] w-[12px] text-green-400" /> : <Copy className="h-[12px] w-[12px]" />}
                  复制链接
                </button>
                <button
                  onClick={() => { handleDeleteSingle(preview.key); setPreview(null); }}
                  className="inline-flex items-center gap-[4px] h-[30px] px-[10px] rounded-md border border-red-400/30 text-[12px] text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 className="h-[12px] w-[12px]" />删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
