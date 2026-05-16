import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Database,
  Download,
  Eye,
  FileUp,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { getToken } from "@/lib/api";
import { platforms, type ImportResult, type PlatformInfo } from "@/lib/importers";

type RestoreMode = "merge" | "overwrite";
type RiskLevel = "low" | "medium" | "high";

type R2Backup = {
  key: string;
  name: string;
  size: number;
  uploaded: string;
};

type BackupPreview = {
  summary: {
    version: string;
    exportedAt: string;
    postCount: number;
    tagCount: number;
    settingsCount: number;
  };
  diff: {
    willCreate: number;
    willUpdate: number;
    willSkip: number;
    tagWillCreate: number;
    willRestoreSettings: number;
    unknownItems: number;
  };
  warnings: string[];
  sample: { title: string; slug: string; status: "create" | "update" | "skip" }[];
  riskLevel: RiskLevel;
};

type RestoreSource =
  | { kind: "r2"; title: string; name: string }
  | { kind: "local"; title: string; data: BackupPayload }
  | { kind: "migration"; title: string; data: BackupPayload };

type BackupPayload = {
  version?: string;
  exportedAt?: string;
  posts?: unknown[];
  tags?: { name: string }[];
  settings?: Record<string, string>;
};

type RestoreWizard = {
  source: RestoreSource;
  preview: BackupPreview;
  mode: RestoreMode;
  includeSettings: boolean;
  confirmText: string;
  step: "preview" | "confirm" | "done";
};

type Toast = { text: string; type: "" | "success" | "error" };

const inputClass = "h-[36px] w-full rounded-md border border-border/35 bg-background/30 px-[12px] text-[13px] text-foreground placeholder:text-muted-foreground/30 outline-none transition-colors focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10";
const buttonClass = "inline-flex min-h-[44px] items-center justify-center gap-[8px] rounded-md px-[14px] text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:pointer-events-none disabled:opacity-45";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} 天前` : new Date(value).toLocaleDateString("zh-CN");
}

function riskCopy(riskLevel: RiskLevel): { label: string; className: string } {
  if (riskLevel === "high") return { label: "高风险", className: "border-red-500/35 bg-red-500/10 text-red-300" };
  if (riskLevel === "medium") return { label: "需确认", className: "border-amber-500/35 bg-amber-500/10 text-amber-300" };
  return { label: "低风险", className: "border-border/40 bg-card/30 text-foreground/72" };
}

function sampleStatusCopy(status: "create" | "update" | "skip") {
  if (status === "update") return "更新";
  if (status === "skip") return "跳过";
  return "新增";
}

export function AdminBackup() {
  const [message, setMessage] = useState<Toast>({ text: "", type: "" });
  const [r2Backups, setR2Backups] = useState<R2Backup[]>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [busy, setBusy] = useState("");
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [webdavExpanded, setWebdavExpanded] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformInfo | null>(platforms[0] || null);
  const [wizard, setWizard] = useState<RestoreWizard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<R2Backup | null>(null);
  const [lastResult, setLastResult] = useState<{ title: string; detail: string } | null>(null);
  const [webdavConfig, setWebdavConfig] = useState({ url: "", username: "", password: "", path: "/monolith-backups" });
  const localFileRef = useRef<HTMLInputElement>(null);
  const migrationFileRef = useRef<HTMLInputElement>(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${getToken()}` }), []);
  const jsonHeaders = useMemo(() => ({ ...authHeaders, "Content-Type": "application/json" }), [authHeaders]);

  const latestBackup = r2Backups[0];
  const totalBackupSize = r2Backups.reduce((sum, item) => sum + item.size, 0);

  const showMsg = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage({ text: "", type: "" }), 4200);
  }, []);

  const loadR2Backups = useCallback(async () => {
    setR2Loading(true);
    try {
      const res = await fetch("/api/admin/backup/r2-list", { headers: authHeaders });
      const data = await res.json();
      setR2Backups(Array.isArray(data) ? data : []);
    } catch {
      setR2Backups([]);
    } finally {
      setR2Loading(false);
    }
  }, [authHeaders]);

  const loadWebdavConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { headers: authHeaders });
      const data = await res.json();
      setWebdavConfig({
        url: data.webdav_url || "",
        username: data.webdav_username || "",
        password: data.webdav_password || "",
        path: data.webdav_path || "/monolith-backups",
      });
    } catch {
      /* 配置读取失败不阻塞备份页面 */
    }
  }, [authHeaders]);

  useEffect(() => {
    document.title = "备份恢复 | Monolith";
    loadR2Backups();
    loadWebdavConfig();
  }, [loadR2Backups, loadWebdavConfig]);

  const requestPreview = useCallback(async (
    source: RestoreSource,
    mode: RestoreMode,
    includeSettings: boolean,
  ): Promise<BackupPreview> => {
    const endpoint = source.kind === "r2" ? "/api/admin/backup/r2-preview" : "/api/admin/backup/preview";
    const body = source.kind === "r2"
      ? { name: source.name, mode, includeSettings }
      : { ...source.data, source: source.title, mode, includeSettings };
    const res = await fetch(endpoint, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "预检失败");
    return data as BackupPreview;
  }, [jsonHeaders]);

  const openWizard = useCallback(async (
    source: RestoreSource,
    mode: RestoreMode = restoreMode,
    includeSettings = source.kind !== "migration" && Boolean(source.kind === "r2" || source.data?.settings),
  ) => {
    setBusy(`preview:${source.title}`);
    try {
      const preview = await requestPreview(source, mode, includeSettings);
      setWizard({ source, preview, mode, includeSettings, confirmText: "", step: "preview" });
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "预检失败", "error");
    } finally {
      setBusy("");
    }
  }, [requestPreview, restoreMode, showMsg]);

  const updateWizardOptions = async (patch: Partial<Pick<RestoreWizard, "mode" | "includeSettings">>) => {
    if (!wizard) return;
    const nextMode = patch.mode || wizard.mode;
    const nextIncludeSettings = patch.includeSettings ?? wizard.includeSettings;
    setWizard((current) => current ? { ...current, mode: nextMode, includeSettings: nextIncludeSettings } : current);
    setBusy("preview-refresh");
    try {
      const preview = await requestPreview(wizard.source, nextMode, nextIncludeSettings);
      setWizard((current) => current ? { ...current, preview, mode: nextMode, includeSettings: nextIncludeSettings } : current);
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "预检刷新失败", "error");
    } finally {
      setBusy("");
    }
  };

  const backupToR2 = async () => {
    setBusy("r2");
    try {
      const res = await fetch("/api/admin/backup/r2", { method: "POST", headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "R2 备份失败");
      showMsg(`已备份到 R2，大小 ${formatSize(data.size)}`, "success");
      setLastResult({ title: "R2 备份完成", detail: "建议保留最近 3-5 个恢复点，并定期下载一份离线 JSON。" });
      loadR2Backups();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "R2 备份失败", "error");
    } finally {
      setBusy("");
    }
  };

  const downloadLocal = async () => {
    setBusy("local");
    try {
      const res = await fetch("/api/admin/backup/export", { headers: authHeaders });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `monolith-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showMsg(`已下载本地备份，包含 ${data.meta?.postCount || 0} 篇文章`, "success");
    } catch {
      showMsg("导出失败", "error");
    } finally {
      setBusy("");
    }
  };

  const handleLocalImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as BackupPayload;
      if (!data.posts && !data.tags && !data.settings) throw new Error("无效的备份文件格式");
      await openWizard({ kind: "local", title: file.name, data }, restoreMode, Boolean(data.settings));
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "文件解析失败，请确认是有效的 JSON 备份", "error");
    } finally {
      if (localFileRef.current) localFileRef.current.value = "";
    }
  };

  const handleMigrationImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length || !selectedPlatform) return;
    setBusy("migration-parse");
    try {
      const result: ImportResult = await selectedPlatform.parse(Array.from(files));
      await openWizard({
        kind: "migration",
        title: `${selectedPlatform.name} 迁移`,
        data: {
          posts: result.posts,
          tags: result.tags,
          exportedAt: new Date().toISOString(),
          version: `migration:${selectedPlatform.id}`,
        },
      }, restoreMode, false);
    } catch (err) {
      showMsg(err instanceof Error ? err.message : `${selectedPlatform.name} 数据解析失败`, "error");
    } finally {
      setBusy("");
      if (migrationFileRef.current) migrationFileRef.current.value = "";
    }
  };

  const saveWebdavConfig = async () => {
    setBusy("webdav-save");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({
          webdav_url: webdavConfig.url,
          webdav_username: webdavConfig.username,
          webdav_password: webdavConfig.password,
          webdav_path: webdavConfig.path,
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      showMsg("WebDAV 配置已保存", "success");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setBusy("");
    }
  };

  const testWebdavConfig = async () => {
    setBusy("webdav-test");
    try {
      const res = await fetch("/api/admin/backup/webdav-test", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(webdavConfig),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "WebDAV 测试失败");
      showMsg("WebDAV 连接和写入测试通过", "success");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "WebDAV 测试失败", "error");
    } finally {
      setBusy("");
    }
  };

  const backupToWebdav = async () => {
    if (!webdavConfig.url || !webdavConfig.username) {
      showMsg("请先配置 WebDAV 地址和用户名", "error");
      setWebdavExpanded(true);
      return;
    }
    setBusy("webdav");
    try {
      const res = await fetch("/api/admin/backup/webdav", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(webdavConfig),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "WebDAV 备份失败");
      showMsg(`已备份到 WebDAV，大小 ${formatSize(data.size)}`, "success");
      setLastResult({ title: "WebDAV 备份完成", detail: "建议保留远程路径不变，后续可与 R2 备份交叉验证。" });
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "WebDAV 连接失败", "error");
    } finally {
      setBusy("");
    }
  };

  const runRestore = async () => {
    if (!wizard) return;
    if (wizard.mode === "overwrite" && wizard.confirmText !== "OVERWRITE") {
      showMsg("覆盖导入需要输入 OVERWRITE", "error");
      return;
    }
    setBusy("restore");
    try {
      const endpoint = wizard.source.kind === "r2" ? "/api/admin/backup/r2-restore" : "/api/admin/backup/restore";
      const body = wizard.source.kind === "r2"
        ? { name: wizard.source.name, mode: wizard.mode, includeSettings: wizard.includeSettings }
        : { ...wizard.source.data, mode: wizard.mode, includeSettings: wizard.includeSettings };
      const res = await fetch(endpoint, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "恢复失败");
      const detail = `写入 ${data.imported.posts} 篇文章、${data.imported.tags} 个标签、${data.imported.settings} 项设置。`;
      setWizard((current) => current ? { ...current, step: "done" } : current);
      setLastResult({ title: "恢复完成", detail: `${detail} 接下来建议检查文章列表、站点配置和搜索优化面板。` });
      showMsg(`恢复完成：${detail}`, "success");
      loadR2Backups();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "恢复请求失败", "error");
    } finally {
      setBusy("");
    }
  };

  const deleteR2Backup = async () => {
    if (!deleteTarget) return;
    setBusy("delete");
    try {
      const res = await fetch("/api/admin/backup/r2-delete", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ name: deleteTarget.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "删除失败");
      setR2Backups((items) => items.filter((item) => item.name !== deleteTarget.name));
      setDeleteTarget(null);
      showMsg("远程备份已删除", "success");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "删除失败", "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] px-[16px] py-[24px] sm:px-[20px] sm:py-[32px]">
      <div className="mb-[20px] flex flex-col gap-[12px] border-b border-border/18 pb-[16px] lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-[4px] text-[11px] font-medium text-muted-foreground/45">DATA SAFETY OPS</p>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-foreground">备份恢复</h1>
          <p className="mt-[4px] max-w-[640px] text-[13px] leading-[1.7] text-muted-foreground/50">
            先预检，再恢复。这里统一管理 R2、WebDAV、本地 JSON 和多平台迁移，降低误覆盖和配置丢失风险。
          </p>
        </div>
        {message.text && (
          <div className={`rounded-md border px-[12px] py-[8px] text-[12px] ${message.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="mb-[20px] grid gap-[8px] md:grid-cols-4">
        <StatusCard label="最近恢复点" value={latestBackup ? timeAgo(latestBackup.uploaded) : "暂无"} detail={latestBackup ? latestBackup.name : "请先创建 R2 或本地备份"} />
        <StatusCard label="R2 备份数" value={String(r2Backups.length)} detail={`累计 ${formatSize(totalBackupSize)}`} />
        <StatusCard label="WebDAV 状态" value={webdavConfig.url ? "已配置" : "未配置"} detail={webdavConfig.url || "建议配置第二远程副本"} />
        <StatusCard label="默认恢复策略" value={restoreMode === "merge" ? "合并" : "覆盖"} detail={restoreMode === "merge" ? "跳过已有文章" : "更新已有文章"} />
      </div>

      {lastResult && (
        <div className="mb-[20px] rounded-md border border-border/22 bg-card/20 p-[14px]">
          <div className="flex items-start gap-[10px]">
            <CheckCircle2 className="mt-[2px] h-[16px] w-[16px] shrink-0 text-emerald-300" />
            <div>
              <p className="text-[13px] font-medium text-foreground">{lastResult.title}</p>
              <p className="mt-[2px] text-[12px] leading-[1.6] text-muted-foreground/50">{lastResult.detail}</p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-[20px] rounded-md border border-border/22 bg-card/16 p-[14px]">
        <div className="mb-[12px] flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
          <SectionTitle icon={Shield} title="快速操作" desc="先创建恢复点，再执行导入或覆盖。" />
          <div className="flex flex-wrap gap-[8px]">
            <select
              value={restoreMode}
              onChange={(event) => setRestoreMode(event.target.value as RestoreMode)}
              className="min-h-[44px] rounded-md border border-border/35 bg-background/30 px-[12px] text-[13px] text-foreground outline-none focus:border-foreground/40"
              aria-label="默认恢复模式"
            >
              <option value="merge">默认合并导入</option>
              <option value="overwrite">默认覆盖导入</option>
            </select>
            <button className={`${buttonClass} bg-foreground text-background hover:opacity-90`} onClick={backupToR2} disabled={Boolean(busy)} type="button">
              {busy === "r2" ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Cloud className="h-[15px] w-[15px]" />}
              创建 R2 备份
            </button>
            <button className={`${buttonClass} border border-border/30 bg-background/25 text-foreground hover:bg-card/30`} onClick={backupToWebdav} disabled={Boolean(busy)} type="button">
              {busy === "webdav" ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Globe className="h-[15px] w-[15px]" />}
              WebDAV 备份
            </button>
            <button className={`${buttonClass} border border-border/30 bg-background/25 text-foreground hover:bg-card/30`} onClick={downloadLocal} disabled={Boolean(busy)} type="button">
              {busy === "local" ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Download className="h-[15px] w-[15px]" />}
              下载 JSON
            </button>
            <input ref={localFileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleLocalImport} />
            <button className={`${buttonClass} border border-border/30 bg-background/25 text-foreground hover:bg-card/30`} onClick={() => localFileRef.current?.click()} disabled={Boolean(busy)} type="button">
              <Upload className="h-[15px] w-[15px]" />
              导入 JSON
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-[20px] xl:grid-cols-[1fr_360px]">
        <main className="space-y-[20px]">
          <section className="rounded-md border border-border/22 bg-card/16">
            <div className="flex items-center justify-between border-b border-border/14 px-[14px] py-[12px]">
              <SectionTitle icon={Cloud} title="R2 备份历史" desc="预检后再恢复，删除需要二次确认。" compact />
              <button
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground/45 transition-colors hover:bg-card/30 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                onClick={loadR2Backups}
                disabled={r2Loading}
                type="button"
                aria-label="刷新 R2 备份历史"
              >
                <RefreshCw className={`h-[15px] w-[15px] ${r2Loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[1.5fr_120px_110px_170px] gap-[12px] border-b border-border/12 px-[14px] py-[10px] text-[11px] font-medium text-muted-foreground/45">
                  <span>文件</span>
                  <span>大小</span>
                  <span>时间</span>
                  <span className="text-right">操作</span>
                </div>
                {r2Loading ? (
                  <EmptyRow text="正在加载 R2 备份..." />
                ) : r2Backups.length === 0 ? (
                  <EmptyRow text="还没有 R2 备份。建议先创建一个远程恢复点。" />
                ) : (
                  r2Backups.map((backup) => (
                    <div key={backup.key} className="grid grid-cols-[1.5fr_120px_110px_170px] items-center gap-[12px] border-b border-border/10 px-[14px] py-[12px] last:border-b-0 hover:bg-card/18">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[12px] text-foreground/80">{backup.name}</p>
                        <p className="mt-[2px] text-[11px] text-muted-foreground/35">{backup.key}</p>
                      </div>
                      <span className="text-[12px] text-muted-foreground/55">{formatSize(backup.size)}</span>
                      <span className="text-[12px] text-muted-foreground/55">{timeAgo(backup.uploaded)}</span>
                      <div className="flex justify-end gap-[6px]">
                        <IconButton
                          label="预检并恢复"
                          busy={busy === `preview:${backup.name}`}
                          onClick={() => openWizard({ kind: "r2", title: backup.name, name: backup.name })}
                          icon={Eye}
                        />
                        <IconButton label="删除备份" onClick={() => setDeleteTarget(backup)} icon={Trash2} danger />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-border/22 bg-card/16 p-[14px]">
            <SectionTitle icon={Database} title="多平台迁移" desc="选择来源平台，解析后进入同一个恢复向导。" />
            <div className="mt-[12px] grid gap-[8px] sm:grid-cols-2 lg:grid-cols-3">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  className={`min-h-[64px] rounded-md border p-[12px] text-left transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20 ${
                    selectedPlatform?.id === platform.id
                      ? "border-foreground/35 bg-foreground/[0.05]"
                      : "border-border/24 bg-background/18 hover:border-border/45 hover:bg-card/24"
                  }`}
                  onClick={() => setSelectedPlatform(platform)}
                  type="button"
                >
                  <span className="block text-[13px] font-medium text-foreground">{platform.name}</span>
                  <span className="mt-[3px] block text-[11px] leading-[1.5] text-muted-foreground/42">{platform.description}</span>
                </button>
              ))}
            </div>
            <div className="mt-[12px] flex flex-col gap-[10px] rounded-md border border-border/18 bg-background/18 p-[12px] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-medium text-foreground">{selectedPlatform ? `从 ${selectedPlatform.name} 导入` : "选择迁移平台"}</p>
                <p className="mt-[2px] text-[11px] text-muted-foreground/42">
                  {selectedPlatform ? `支持 ${selectedPlatform.accept.replace(/\./g, "").toUpperCase()}${selectedPlatform.multiple ? "，可多选文件" : ""}` : "先选择一个来源平台。"}
                </p>
              </div>
              <input
                ref={migrationFileRef}
                type="file"
                accept={selectedPlatform?.accept}
                multiple={selectedPlatform?.multiple}
                className="hidden"
                onChange={handleMigrationImport}
              />
              <button
                className={`${buttonClass} bg-foreground text-background hover:opacity-90`}
                onClick={() => migrationFileRef.current?.click()}
                disabled={!selectedPlatform || Boolean(busy)}
                type="button"
              >
                {busy === "migration-parse" ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <FileUp className="h-[15px] w-[15px]" />}
                解析并预检
              </button>
            </div>
          </section>
        </main>

        <aside className="space-y-[20px]">
          <section className="rounded-md border border-border/22 bg-card/16 p-[14px]">
            <button className="flex w-full items-center justify-between text-left" onClick={() => setWebdavExpanded((value) => !value)} type="button">
              <SectionTitle icon={Globe} title="WebDAV 连接" desc="用于第二远程副本和跨平台备份。" compact />
              {webdavExpanded ? <ChevronUp className="h-[16px] w-[16px] text-muted-foreground/45" /> : <ChevronDown className="h-[16px] w-[16px] text-muted-foreground/45" />}
            </button>
            {webdavExpanded && (
              <div className="mt-[12px] space-y-[10px]">
                <Field label="服务器地址">
                  <input value={webdavConfig.url} onChange={(event) => setWebdavConfig((prev) => ({ ...prev, url: event.target.value }))} placeholder="https://dav.example.com/dav/" className={inputClass} />
                </Field>
                <Field label="用户名">
                  <input value={webdavConfig.username} onChange={(event) => setWebdavConfig((prev) => ({ ...prev, username: event.target.value }))} placeholder="you@example.com" className={inputClass} />
                </Field>
                <Field label="密码 / 应用密钥">
                  <input type="password" value={webdavConfig.password} onChange={(event) => setWebdavConfig((prev) => ({ ...prev, password: event.target.value }))} placeholder="应用专用密码" className={inputClass} />
                </Field>
                <Field label="远程路径">
                  <input value={webdavConfig.path} onChange={(event) => setWebdavConfig((prev) => ({ ...prev, path: event.target.value }))} placeholder="/monolith-backups" className={inputClass} />
                </Field>
                <div className="grid gap-[8px] sm:grid-cols-2 xl:grid-cols-1">
                  <button className={`${buttonClass} border border-border/30 bg-background/25 text-foreground hover:bg-card/30`} onClick={testWebdavConfig} disabled={Boolean(busy)} type="button">
                    {busy === "webdav-test" ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Shield className="h-[15px] w-[15px]" />}
                    测试连接
                  </button>
                  <button className={`${buttonClass} bg-foreground text-background hover:opacity-90`} onClick={saveWebdavConfig} disabled={Boolean(busy)} type="button">
                    保存配置
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-md border border-border/22 bg-card/16 p-[14px]">
            <SectionTitle icon={AlertTriangle} title="恢复守则" desc="恢复操作的防误触规则。" />
            <ul className="mt-[10px] space-y-[8px] text-[12px] leading-[1.6] text-muted-foreground/50">
              <li>合并模式会跳过已有 slug，适合迁移或追加。</li>
              <li>覆盖模式会更新已有文章，必须输入确认文本。</li>
              <li>设置项恢复会影响站点配置、SEO 和第三方注入。</li>
              <li>恢复完成后建议立即创建新的恢复点。</li>
            </ul>
          </section>
        </aside>
      </div>

      {wizard && (
        <RestoreWizardDialog
          wizard={wizard}
          busy={busy}
          onClose={() => setWizard(null)}
          onModeChange={(mode) => updateWizardOptions({ mode })}
          onIncludeSettingsChange={(includeSettings) => updateWizardOptions({ includeSettings })}
          onConfirmTextChange={(confirmText) => setWizard((current) => current ? { ...current, confirmText } : current)}
          onStepChange={(step) => setWizard((current) => current ? { ...current, step } : current)}
          onRestore={runRestore}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          backup={deleteTarget}
          busy={busy === "delete"}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteR2Backup}
        />
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, desc, compact = false }: { icon: React.ElementType; title: string; desc?: string; compact?: boolean }) {
  return (
    <div className={compact ? "" : "mb-[2px]"}>
      <div className="flex items-center gap-[8px]">
        <Icon className="h-[15px] w-[15px] text-muted-foreground/45" />
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
      </div>
      {desc && <p className="mt-[3px] text-[11px] leading-[1.5] text-muted-foreground/42">{desc}</p>}
    </div>
  );
}

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border/22 bg-card/16 p-[12px]">
      <p className="text-[11px] text-muted-foreground/42">{label}</p>
      <p className="mt-[6px] font-mono text-[20px] font-semibold tracking-[-0.02em] text-foreground">{value}</p>
      <p className="mt-[4px] truncate text-[11px] text-muted-foreground/38">{detail}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-[14px] py-[28px] text-center text-[12px] text-muted-foreground/40">{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[4px] block text-[11px] font-medium text-muted-foreground/45">{label}</span>
      {children}
    </label>
  );
}

function IconButton({ label, icon: Icon, onClick, busy = false, danger = false }: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20 ${
        danger ? "text-muted-foreground/45 hover:bg-red-500/10 hover:text-red-300" : "text-muted-foreground/45 hover:bg-card/30 hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
      aria-label={label}
      title={label}
    >
      {busy ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Icon className="h-[15px] w-[15px]" />}
    </button>
  );
}

function RestoreWizardDialog({
  wizard,
  busy,
  onClose,
  onModeChange,
  onIncludeSettingsChange,
  onConfirmTextChange,
  onStepChange,
  onRestore,
}: {
  wizard: RestoreWizard;
  busy: string;
  onClose: () => void;
  onModeChange: (mode: RestoreMode) => void;
  onIncludeSettingsChange: (includeSettings: boolean) => void;
  onConfirmTextChange: (value: string) => void;
  onStepChange: (step: RestoreWizard["step"]) => void;
  onRestore: () => void;
}) {
  const risk = riskCopy(wizard.preview.riskLevel);
  const canRestore = wizard.mode !== "overwrite" || wizard.confirmText === "OVERWRITE";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 px-[12px] py-[12px] backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[880px] overflow-hidden rounded-md border border-border/35 bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b border-border/18 px-[16px] py-[14px]">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground/45">RESTORE WIZARD</p>
            <h3 className="mt-[3px] text-[18px] font-semibold tracking-[-0.02em] text-foreground">{wizard.source.title}</h3>
          </div>
          <button className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground/45 hover:bg-card/30 hover:text-foreground" onClick={onClose} type="button" aria-label="关闭恢复向导">
            <X className="h-[16px] w-[16px]" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-156px)] overflow-y-auto p-[16px]">
          {wizard.step === "done" ? (
            <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-[16px]">
              <div className="flex gap-[10px]">
                <CheckCircle2 className="mt-[2px] h-[18px] w-[18px] shrink-0 text-emerald-300" />
                <div>
                  <p className="text-[14px] font-medium text-foreground">恢复已完成</p>
                  <p className="mt-[4px] text-[12px] leading-[1.7] text-muted-foreground/55">建议检查文章列表、站点配置和 SEO 面板，然后创建一个新的恢复点。</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-[16px] lg:grid-cols-[1fr_280px]">
              <div className="space-y-[14px]">
                <div className="grid gap-[8px] sm:grid-cols-4">
                  <MiniStat label="文章" value={String(wizard.preview.summary.postCount)} />
                  <MiniStat label="标签" value={String(wizard.preview.summary.tagCount)} />
                  <MiniStat label="设置项" value={String(wizard.preview.summary.settingsCount)} />
                  <div className={`rounded-md border p-[10px] ${risk.className}`}>
                    <p className="text-[11px] opacity-75">风险</p>
                    <p className="mt-[4px] text-[16px] font-semibold">{risk.label}</p>
                  </div>
                </div>

                <div className="rounded-md border border-border/20 bg-card/16 p-[12px]">
                  <p className="mb-[10px] text-[13px] font-medium text-foreground">恢复差异</p>
                  <div className="grid gap-[8px] sm:grid-cols-3">
                    <DiffItem label="新增文章" value={wizard.preview.diff.willCreate} />
                    <DiffItem label="更新文章" value={wizard.preview.diff.willUpdate} />
                    <DiffItem label="跳过文章" value={wizard.preview.diff.willSkip} />
                    <DiffItem label="新增标签" value={wizard.preview.diff.tagWillCreate} />
                    <DiffItem label="恢复设置" value={wizard.preview.diff.willRestoreSettings} />
                    <DiffItem label="待确认项" value={wizard.preview.diff.unknownItems} />
                  </div>
                </div>

                {wizard.preview.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-[12px]">
                    <p className="mb-[8px] text-[13px] font-medium text-amber-200">预检提醒</p>
                    <ul className="space-y-[6px] text-[12px] leading-[1.6] text-amber-100/75">
                      {wizard.preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  </div>
                )}

                <div className="rounded-md border border-border/20 bg-card/16">
                  <div className="border-b border-border/14 px-[12px] py-[10px] text-[13px] font-medium text-foreground">样本文章</div>
                  <div className="max-h-[260px] overflow-y-auto">
                    {wizard.preview.sample.length === 0 ? (
                      <div className="px-[12px] py-[20px] text-[12px] text-muted-foreground/40">没有文章样本。</div>
                    ) : (
                      wizard.preview.sample.map((post) => (
                        <div key={`${post.slug}-${post.status}`} className="flex items-center justify-between gap-[12px] border-b border-border/10 px-[12px] py-[9px] last:border-b-0">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] text-foreground/78">{post.title}</p>
                            <p className="mt-[2px] truncate font-mono text-[10px] text-muted-foreground/35">{post.slug}</p>
                          </div>
                          <span className="shrink-0 rounded-md border border-border/20 px-[7px] py-[3px] text-[10px] text-muted-foreground/55">{sampleStatusCopy(post.status)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <aside className="space-y-[12px]">
                <div className="rounded-md border border-border/20 bg-card/16 p-[12px]">
                  <p className="mb-[8px] text-[13px] font-medium text-foreground">恢复策略</p>
                  <label className="mb-[8px] block">
                    <span className="mb-[4px] block text-[11px] text-muted-foreground/45">导入模式</span>
                    <select className={inputClass} value={wizard.mode} onChange={(event) => onModeChange(event.target.value as RestoreMode)} disabled={busy === "preview-refresh"}>
                      <option value="merge">合并，跳过已有文章</option>
                      <option value="overwrite">覆盖，更新已有文章</option>
                    </select>
                  </label>
                  {wizard.preview.summary.settingsCount > 0 && (
                    <label className="flex min-h-[44px] items-center gap-[8px] rounded-md border border-border/18 bg-background/20 px-[10px] text-[12px] text-foreground">
                      <input type="checkbox" checked={wizard.includeSettings} onChange={(event) => onIncludeSettingsChange(event.target.checked)} />
                      恢复站点设置
                    </label>
                  )}
                </div>

                {wizard.mode === "overwrite" && (
                  <div className="rounded-md border border-red-500/25 bg-red-500/10 p-[12px]">
                    <p className="text-[12px] leading-[1.6] text-red-100/80">覆盖导入会更新已有文章。请输入 OVERWRITE 解锁最终操作。</p>
                    <input className={`${inputClass} mt-[8px] border-red-500/30`} value={wizard.confirmText} onChange={(event) => onConfirmTextChange(event.target.value)} placeholder="OVERWRITE" />
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-[8px] border-t border-border/18 px-[16px] py-[12px] sm:flex-row sm:justify-end">
          <button className={`${buttonClass} border border-border/30 bg-background/25 text-foreground hover:bg-card/30`} onClick={onClose} type="button">
            {wizard.step === "done" ? "关闭" : "取消"}
          </button>
          {wizard.step === "preview" && (
            <button className={`${buttonClass} bg-foreground text-background hover:opacity-90`} onClick={() => onStepChange("confirm")} type="button">
              进入最终确认
            </button>
          )}
          {wizard.step === "confirm" && (
            <button className={`${buttonClass} bg-foreground text-background hover:opacity-90`} onClick={onRestore} disabled={!canRestore || busy === "restore"} type="button">
              {busy === "restore" ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Database className="h-[15px] w-[15px]" />}
              确认恢复
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/18 bg-background/20 p-[10px]">
      <p className="text-[11px] text-muted-foreground/42">{label}</p>
      <p className="mt-[4px] font-mono text-[17px] font-semibold tracking-[-0.02em] text-foreground">{value}</p>
    </div>
  );
}

function DiffItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background/20 px-[10px] py-[8px]">
      <p className="text-[11px] text-muted-foreground/42">{label}</p>
      <p className="mt-[3px] font-mono text-[16px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ConfirmDeleteDialog({ backup, busy, onCancel, onConfirm }: {
  backup: R2Backup;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 px-[12px] py-[12px] backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[440px] rounded-md border border-border/35 bg-background p-[16px] shadow-2xl">
        <div className="flex gap-[10px]">
          <AlertTriangle className="mt-[2px] h-[18px] w-[18px] shrink-0 text-red-300" />
          <div>
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">删除远程备份</h3>
            <p className="mt-[6px] text-[12px] leading-[1.7] text-muted-foreground/55">将删除 R2 中的备份文件，操作不可撤销。</p>
            <p className="mt-[8px] break-all rounded-md border border-border/18 bg-card/18 p-[8px] font-mono text-[11px] text-muted-foreground/60">{backup.name}</p>
          </div>
        </div>
        <div className="mt-[16px] flex flex-col gap-[8px] sm:flex-row sm:justify-end">
          <button className={`${buttonClass} border border-border/30 bg-background/25 text-foreground hover:bg-card/30`} onClick={onCancel} type="button">取消</button>
          <button className={`${buttonClass} bg-red-500/14 text-red-100 hover:bg-red-500/20`} onClick={onConfirm} disabled={busy} type="button">
            {busy ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Trash2 className="h-[15px] w-[15px]" />}
            删除备份
          </button>
        </div>
      </div>
    </div>
  );
}
