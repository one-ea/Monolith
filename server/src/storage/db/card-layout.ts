const CARD_WIDTH_MIN = 42;
const CARD_WIDTH_MAX = 100;
const CARD_WIDTH_DEFAULT = 100;
const CARD_HEIGHT_MIN = 156;
const CARD_HEIGHT_MAX = 420;
const CARD_HEIGHT_DEFAULT = 220;

export function normalizeCardWidth(value: number | undefined | null): number {
  const next = typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : CARD_WIDTH_DEFAULT;
  return Math.min(CARD_WIDTH_MAX, Math.max(CARD_WIDTH_MIN, next));
}

export function normalizeCardHeight(value: number | undefined | null): number {
  const next = typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : CARD_HEIGHT_DEFAULT;
  return Math.min(CARD_HEIGHT_MAX, Math.max(CARD_HEIGHT_MIN, next));
}
