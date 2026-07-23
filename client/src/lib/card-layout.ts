export type CardImageMode = "text" | "background" | "side" | "top" | "thumbnail";
export type CardGridSize = "full" | "half" | "third";

export const CARD_IMAGE_MODE_LABEL: Record<CardImageMode, string> = {
  text: "纯文字",
  background: "背景图",
  side: "侧图",
  top: "顶图",
  thumbnail: "缩略图",
};

export function clampCardWidth(value: number | null | undefined) {
  const next = Number.isFinite(value) ? Number(value) : 100;
  return Math.min(100, Math.max(42, Math.round(next)));
}

export function clampCardHeight(value: number | null | undefined) {
  const next = Number.isFinite(value) ? Number(value) : 220;
  return Math.min(420, Math.max(156, Math.round(next)));
}

export function getCardGridSize(width: number): CardGridSize {
  const normalized = clampCardWidth(width);
  if (normalized >= 84) return "full";
  if (normalized >= 58) return "half";
  return "third";
}

export const CARD_GRID_SIZE_LABEL: Record<CardGridSize, string> = {
  full: "整行",
  half: "双列",
  third: "三列",
};

export function getArticleCardImageMode(width: number, height: number, hasCover: boolean): CardImageMode {
  if (!hasCover) return "text";
  if (width >= 82 && height >= 260) return "background";
  if (width >= 68 && height >= 190) return "side";
  if (height >= 250) return "top";
  return "thumbnail";
}
