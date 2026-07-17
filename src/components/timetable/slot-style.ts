/**
 * 週曆 slot 狀態樣式(桌面格 / 手機卡共用)。
 * 狀態一律「狀態色淡底 + 文字標示」(不能只靠顏色;§2、§3)。
 * 顏色全走 CSS variables 對接的 Tailwind token,元件不 hardcode hex。
 */

/**
 * 時間軸比例:1 分鐘 = 1.2px → 60 分課 72px、90 分課 108px(皆 ≥44px touch target)。
 * WeekGrid(欄 = 日)與 DayResourceGrid(欄 = 資源)共用同一比例,兩種檢視切換時
 * 格子高度才一致。
 */
export const PX_PER_MIN = 1.2;

interface SlotStatus {
  isPast: boolean;
  isFull: boolean;
}

/** 格/卡的底色 + 邊框(狀態填色;資源色只做色條/圓點) */
export function slotToneClasses(s: SlotStatus): string {
  if (s.isPast) return "border-border bg-status-closed/30 text-muted";
  if (s.isFull) return "border-status-full/40 bg-status-full/15 text-text";
  return "border-status-available/40 bg-status-available/15 text-text";
}

/** 狀態 badge(pill;文字 + 色)*/
export function slotBadge(s: SlotStatus): { text: string; className: string } {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (s.isPast) {
    return { text: "已過", className: `${base} bg-status-closed/50 text-muted` };
  }
  if (s.isFull) {
    return {
      text: "滿",
      className: `${base} bg-status-full/20 text-status-full-strong`,
    };
  }
  return {
    text: "有位",
    className: `${base} bg-status-available/20 text-status-available-strong`,
  };
}

/** 日期頂部標籤(公休/請假/特殊時段) */
export function dayTagClasses(tone: "closed" | "special"): string {
  const base =
    "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px]";
  return tone === "closed"
    ? `${base} bg-status-closed/60 text-text`
    : `${base} bg-status-pending/20 text-status-pending-strong`;
}
