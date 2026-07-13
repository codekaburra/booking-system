"use client";

/**
 * 模式 A 步驟②:月曆日期選擇器(設計規範 booking-ui-extensions §3/§4)。
 *
 * - 月格線(週 × 7,週一為首,與 P2 週課表一致)+ 上/下月導覽,預設當月(台北)。
 * - 過去日期 dim 且不可選;當日 0 個可預約時段者顯示但不可選(dim)。
 * - 每格顯示「當日可預約時段數」(數字必顯示,不單靠顏色)+ 有位密度色階(status-available)。
 * - 點某日 → 下方列出當日可預約時段(可勾選);勾選順序 = 志願序(togglePreference)。
 * - 持久「已選志願」摘要(#1/#2…可跨日跨月),含移除鈕(移除自動遞補序號)。
 *
 * 資料:上層已把該課程「未來 + 有空位」的 slots 傳入(依 starts_at 排序);此處純顯示。
 */

import { useMemo, useState } from "react";
import { preferenceOrderOf } from "@/lib/booking/preferences";
import { addDays, mondayOf, weekdayZh } from "@/lib/tz";
import type { BookableSlot } from "@/lib/booking/types";

interface Props {
  /** 該課程未來的**全部** slots(含已額滿);可勾選 = booked < capacity */
  slots: BookableSlot[];
  /** 已選 slotId(志願序 = index) */
  selected: string[];
  onToggle: (slotId: string) => void;
  /** 台北今天 "YYYY-MM-DD"(server 計算,避免 hydration 時區偏差) */
  today: string;
}

/** 有空位可勾選?(false = 未來但已額滿 → 以 disabled「已額滿」呈現) */
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

export function MonthPicker({ slots, selected, onToggle, today }: Props) {
  // 當日全部 slots(含已額滿),供日檢視列出
  const byDate = useMemo(() => {
    const m = new Map<string, BookableSlot[]>();
    for (const s of slots) {
      const list = m.get(s.date);
      if (list) list.push(s);
      else m.set(s.date, [s]);
    }
    return m;
  }, [slots]);

  // 當日「可預約(有空位)」數 —— 月格線密度與預設選中日用
  const availByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) {
      if (isBookable(s)) m.set(s.date, (m.get(s.date) ?? 0) + 1);
    }
    return m;
  }, [slots]);

  const slotById = useMemo(
    () => new Map(slots.map((s) => [s.slotId, s])),
    [slots],
  );

  // 範圍界線(供下月導覽 disable);含已額滿的最後一天
  const lastDate = useMemo(
    () => (slots.length ? slots[slots.length - 1].date : today),
    [slots, today],
  );
  // 第一個有空位的日期(預設選中日 fallback)
  const firstAvailDate = useMemo(
    () => slots.find((s) => isBookable(s))?.date ?? null,
    [slots],
  );

  const todayYm = ym(today);
  const [view, setView] = useState(() => ym(today));

  // 預設選中日:今天(若有位)否則第一個有位日,再否則第一個有時段的日
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    if ((availByDate.get(today) ?? 0) > 0) return today;
    if (firstAvailDate) return firstAvailDate;
    return slots.length ? slots[0].date : null;
  });

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

  const selectedDaySlots = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  const monthLabel = `${view.year} 年 ${view.month} 月`;

  const navBtn =
    "flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-lg text-text transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text";

  return (
    <div className="flex flex-col gap-5">
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
          // 有任何未來時段即可開啟(即使全額滿也讓使用者點進去看 disabled 列)
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
              onClick={() => openable && setSelectedDate(date)}
              className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-center transition focus:outline-none focus:ring-2 focus:ring-primary ${
                isActiveDay
                  ? "border-primary ring-1 ring-primary"
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
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary"
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
          <span className="h-3 w-3 rounded bg-border opacity-60" />無時段 / 已過
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />已選志願
        </span>
      </div>

      {/* 選中日的可預約時段 */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          {selectedDate
            ? `${Number(selectedDate.slice(5, 7))}/${Number(
                selectedDate.slice(8, 10),
              )}(${weekdayZh(selectedDate)})可預約時段`
            : "請選擇日期"}
        </h3>
        {selectedDate && selectedDaySlots.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            這天沒有時段,請點選月曆上其他有位的日期。
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedDaySlots.map((s) => {
              const bookable = isBookable(s);
              if (!bookable) {
                // 未來但已額滿:disabled、灰、以 --status-full + 文字標「已額滿」(不單靠顏色)
                return (
                  <div
                    key={s.slotId}
                    aria-disabled
                    className="relative flex min-h-11 items-center gap-3 rounded-xl border border-border bg-surface p-3 pl-4 opacity-60"
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
                      style={{ background: s.resourceColor ?? "var(--color-muted)" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium line-through decoration-1">
                        {s.timeLabel}
                      </span>
                      <span className="block text-xs text-muted">{s.resourceName}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-status-full/15 px-2 py-0.5 text-[11px] font-medium text-status-full-strong">
                      已額滿
                    </span>
                  </div>
                );
              }
              const order = preferenceOrderOf(selected, s.slotId);
              const isSel = order > 0;
              return (
                <button
                  key={s.slotId}
                  type="button"
                  aria-pressed={isSel}
                  onClick={() => onToggle(s.slotId)}
                  className={`relative flex min-h-11 items-center gap-3 rounded-xl border p-3 pl-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary ${
                    isSel
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:border-primary/50"
                  }`}
                >
                  {/* 資源色:左側色條(不做狀態填色) */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
                    style={{ background: s.resourceColor ?? "var(--color-muted)" }}
                  />
                  {isSel && (
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-surface"
                    >
                      {order}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.timeLabel}</span>
                    <span className="block text-xs text-muted">
                      {s.resourceName}
                      {s.capacity > 1 && `・餘 ${s.capacity - s.booked}/${s.capacity} 位`}
                    </span>
                  </span>
                  <span className="sr-only">
                    {isSel ? `已選為第 ${order} 志願` : "點選以加入志願"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 已選志願摘要(持久;跨日跨月) */}
      {selected.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <h3 className="text-sm font-medium">已選志願({selected.length})</h3>
          <ol className="flex flex-col gap-2">
            {selected.map((id, i) => {
              const s = slotById.get(id);
              if (!s) return null;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-surface">
                    {i + 1}
                  </span>
                  <span
                    aria-hidden
                    className="h-7 w-1 shrink-0 rounded-full"
                    style={{ background: s.resourceColor ?? "var(--color-muted)" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {s.dayLabel} {s.timeLabel}
                    </span>
                    <span className="block text-xs text-muted">{s.resourceName}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`移除第 ${i + 1} 志願`}
                    onClick={() => onToggle(id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-status-full/10 hover:text-status-full-strong focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
