import type { SiteDateSettings } from "@/lib/site-settings";

function parseSiteDate(value: string): Date {
  // SQLite datetime('now') 返回 `YYYY-MM-DD HH:mm:ss`，语义是 UTC，
  // 但浏览器会把没有时区标记的日期时间误解为本地时间。
  const isSqliteDateTime = value.length === 19
    && (value[10] === " " || value[10] === "T")
    && value[4] === "-"
    && value[7] === "-"
    && value[13] === ":"
    && value[16] === ":"
    && [0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18].every((index) => {
      const code = value.charCodeAt(index);
      return code >= 48 && code <= 57;
    });
  const normalized = isSqliteDateTime
    ? `${value.replace(" ", "T")}Z`
    : value;
  return new Date(normalized);
}

export function formatSiteDate(value: string | null | undefined, settings: SiteDateSettings): string {
  if (!value) return "";

  const date = parseSiteDate(value);
  if (Number.isNaN(date.getTime())) return "";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: settings.timezone || "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  if (settings.datePrecision === "datetime" || settings.datePrecision === "datetime_seconds") {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  if (settings.datePrecision === "datetime_seconds") {
    options.second = "2-digit";
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", options).format(date);
  } catch {
    return new Intl.DateTimeFormat("zh-CN", {
      ...options,
      timeZone: "Asia/Shanghai",
    }).format(date);
  }
}

export function getSiteDateYear(value: string | null | undefined, settings: SiteDateSettings): string {
  if (!value) return "";

  const date = parseSiteDate(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: settings.timezone || "Asia/Shanghai",
      year: "numeric",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
    }).format(date);
  }
}
