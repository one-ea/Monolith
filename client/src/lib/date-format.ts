import type { SiteDateSettings } from "@/lib/site-settings";

export function formatSiteDate(value: string | null | undefined, settings: SiteDateSettings): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: settings.timezone || "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  if (settings.datePrecision === "datetime") {
    options.hour = "2-digit";
    options.minute = "2-digit";
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

