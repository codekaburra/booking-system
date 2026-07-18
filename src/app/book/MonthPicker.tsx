"use client";

/**
 * 模式 A 步驟②:跳日用月曆(設計規範 booking-ui-extensions §8a)。
 *
 * §8a 改版後月曆不再常駐:由 SlotPicker 的月份標籤(「7月 2026 ›」)以彈層開啟,
 * 點某日 → onPick(date) → SlotPicker 關閉彈層並把單週日期橫條捲到該週。
 *
 * - 月格線(週 × 7,週一為首,與 P2 週課表一致)+ 上/下月導覽;
 *   預設顯示「目前選中日(否則今天)」所在月。
 * - 過去日期 dim 且不可選;有任何未來時段的日子可點(即使全額滿 —— 進去看 disabled 列)。
 * - 每格顯示「當日可預約時段數」(數字必顯示,不單靠顏色)+ 有位密度色階(status-available)。
 * - 已含所選志願的日子顯示主色小圓點(跨日複選時快速辨識)。
 *
 * 資料:上層已把該課程「未來全部」slots 傳入(依 starts_at 排序);此處純顯示。
 */

import { useMemo, useState } from "react";
import { addDays, mondayOf } from "@/lib/tz";
import type { BookableSlot } from "@/lib/booking/types";

interface Props {
  /** 該課程未來的**全部** slots(含已額滿);可預約 = booked < capacity */
  slots: BookableSlot[];
  /** 已選 slotId(顯示「該日含志願」小圓點用) */
  selected: string[];
  /** 台北今天 "YYYY-MM-DD"(server 計算,避免 hydration 時區偏差) */
  today: string;
  /** 目前選中日(高亮 + 決定預設顯示月份) */
  selectedDate: string | null;
  /** 點選某一天(僅可點「未來且有時段」的日子) */
  onPick: (date: string) => void;
}

/** 有空位可預約?(false = 未來但已額滿) */
function isBookable(s: BookableSlot): boolean {
  return s.booked < s.capacity;
}

const WEEKDAY_HEAD = ["一", "二", "三", "四", "五", "六", "日"] as const;

function ym(date: string): { year: number; month: number } {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}
function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
function addMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
/** 有位密度色階:0 → 無;1–2 → 淡;3–5 → 中;6+ → 深 */
function tintClass(count: number): string {
  if (count === 0) return "";
  if (count <= 2) return "bg-status-available/10";
  if (count <= 5) return "bg-status-available/20";
  return "bg-status-available/35";
}

export function MonthPicker({ slots, selected, today, selectedDate, onPick }: Props) {
  // 當日全部 slots(含已額滿)
  const byDate = useMemo(() => {
    const m = new Map<string, BookableSlot[]>();
    for (const s of slots) {
      const list = m.get(s.date);
      if (list) list.push(s);
      else m.set(s.date, [s]);
    }
    return m;
  }, [slots]);

  // 當日「可預約(有空位)」數 —— 密度色階與格內數字用
  const availByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) {
      if (isBookable(s)) m.set(s.date, (m.get(s.date) ?? 0) + 1);
    }
    return m;
  }, [slots]);

  // 範圍界線(供下月導覽 disable);含已額滿的最後一天
  const lastDate = useMemo(
    () => (slots.length ? slots[slots.length - 1].date : today),
    [slots, today],
  );

  const todayYm = ym(today);
  const [view, setView] = useState(() => ym(selectedDate ?? today));

  // 42 格(6 週 × 7),週一為首
  const cells = useMemo(() => {
    const gridStart = mondayOf(firstOfMonth(view.year, view.month));
    const prefix = `${view.year}-${String(view.month).padStart(2, "0")}-`;
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i);
      return { date, inMonth: date.startsWith(prefix) };
    });
  }, [view]);

  const prevDisabled = view.year === todayYm.year && view.month === todayYm.month;
  const lastYm = ym(lastDate);
  const nextDisabled =
    view.year > lastYm.year ||
    (view.year === lastYm.year && view.month >= lastYm.month);

  const monthLabel = `${view.year} 年 ${view.month} 月`;

  const navBtn =
    "flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-lg text-text transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text";

  return (
    <div className="flex flex-col gap-4">
      {/* 月導覽 */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="上個月"
          disabled={prevDisabled}
          onClick={() => setView(addMonth(view.year, view.month, -1))}
          className={navBtn}
        >
          ‹
        </button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <button
          type="button"
          aria-label="下個月"
          disabled={nextDisabled}
          onClick={() => setView(addMonth(view.year, view.month, 1))}
          className={navBtn}
        >
          ›
        </button>
      </div>

      {/* 星期表頭 */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {WEEKDAY_HEAD.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* 月格線 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }) => {
          const dayNum = Number(date.slice(8, 10));
          const total = byDate.get(date)?.length ?? 0; // 含已額滿
          const avail = availByDate.get(date) ?? 0;
          const isPast = date < today;
          const isToday = date === today;
          // 有任何未來時段即可點(即使全額滿也讓使用者跳過去看 disabled 列)
          const openable = inMonth && !isPast && total > 0;
          const fullOnly = total > 0 && avail === 0;
          const hasSelected = (byDate.get(date) ?? []).some((s) =>
            selected.includes(s.slotId),
          );
          const isActiveDay = date === selectedDate;

          if (!inMonth) {
            return <div key={date} aria-hidden className="min-h-[3.25rem]" />;
          }

          return (
            <button
              key={date}
              type="button"
              disabled={!openable}
              aria-pressed={isActiveDay}
              aria-label={`${view.month}/${dayNum},${
                avail > 0
                  ? `可預約 ${avail} 個時段`
                  : fullOnly
                    ? "已額滿"
                    : "無可預約時段"
              }`}
              onClick={() => openable && onPick(date)}
              className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-center transition focus:outline-none focus:ring-2 focus:ring-primary ${
                isActiveDay
                  ? "border-primary-deep ring-1 ring-primary-deep"
                  : "border-transparent"
              } ${
                openable
                  ? `${avail > 0 ? tintClass(avail) : "bg-status-full/10"} hover:border-primary/60`
                  : "cursor-not-allowed"
              } ${isPast || avail === 0 ? "opacity-45" : ""}`}
            >
              <span
                className={`text-sm ${isToday ? "font-bold text-primary" : "font-medium"}`}
              >
                {dayNum}
              </span>
              {avail > 0 ? (
                <span className="text-[10px] leading-none text-status-available-strong">
                  {avail} 位
                </span>
              ) : fullOnly ? (
                <span className="text-[10px] leading-none text-status-full-strong">
                  額滿
                </span>
              ) : (
                <span className="text-[10px] leading-none text-muted">—</span>
              )}
              {hasSelected && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary-deep"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 密度圖例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-status-available/20" />有位(數字為可預約時段數)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-status-full/10" />已額滿(可點看時段)
        </span>
        <span className="flex items-center gap-1.5">
          {/* 與實際格子一致:透明底 + 淡化(格子是 opacity-45 文字,無填色) */}
          <span className="h-3 w-3 rounded border border-border opacity-45" />
          無時段 / 已過
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-deep" />已選志願
        </span>
      </div>
    </div>
  );
}
