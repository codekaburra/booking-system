"use client";

/**
 * 模式 A 步驟②:月曆日期選擇器(設計規範 booking-ui-extensions §3/§4)。
 *
 * - **整月格線**(5–6 週 × 7,週一為首)+ 上/下月導覽;含前後月補齊日。
 * - 下方列出**當月所有有時段的日期**(可捲動),不是只顯示單日或單週。
 * - 點月曆某日 → 捲動至該日區塊並高亮;勾選順序 = 志願序。
 */

import { useMemo, useRef, useState } from "react";
import { preferenceOrderOf } from "@/lib/booking/preferences";
import { buildMonthGrid, weekdayZh } from "@/lib/tz";
import type { BookableSlot } from "@/lib/booking/types";

interface Props {
  /** 該課程未來的**全部** slots(含已額滿);可勾選 = booked < capacity */
  slots: BookableSlot[];
  selected: string[];
  onToggle: (slotId: string) => void;
  /** 台北今天 "YYYY-MM-DD"(server 計算,避免 hydration 時區偏差) */
  today: string;
}

function isBookable(s: BookableSlot): boolean {
  return s.booked < s.capacity;
}

const WEEKDAY_HEAD = ["一", "二", "三", "四", "五", "六", "日"] as const;

function ym(date: string): { year: number; month: number } {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}
function addMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
function tintClass(count: number): string {
  if (count === 0) return "";
  if (count <= 2) return "bg-status-available/10";
  if (count <= 5) return "bg-status-available/20";
  return "bg-status-available/35";
}
function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-`;
}

export function MonthPicker({ slots, selected, onToggle, today }: Props) {
  const dayRefs = useRef<Map<string, HTMLElement>>(new Map());

  const byDate = useMemo(() => {
    const m = new Map<string, BookableSlot[]>();
    for (const s of slots) {
      const list = m.get(s.date);
      if (list) list.push(s);
      else m.set(s.date, [s]);
    }
    return m;
  }, [slots]);

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

  const lastDate = useMemo(
    () => (slots.length ? slots[slots.length - 1].date : today),
    [slots, today],
  );
  const firstAvailDate = useMemo(
    () => slots.find((s) => isBookable(s))?.date ?? null,
    [slots],
  );

  const todayYm = ym(today);
  const [view, setView] = useState(() => ym(today));
  const [focusedDate, setFocusedDate] = useState<string | null>(() => {
    if ((availByDate.get(today) ?? 0) > 0) return today;
    if (firstAvailDate) return firstAvailDate;
    return slots.length ? slots[0].date : null;
  });

  const cells = useMemo(
    () => buildMonthGrid(view.year, view.month),
    [view.year, view.month],
  );

  /** 當月所有「未來且有時段」的日期(整月列表,非單週) */
  const monthDates = useMemo(() => {
    const prefix = monthPrefix(view.year, view.month);
    return [...byDate.keys()]
      .filter((d) => d.startsWith(prefix) && d >= today)
      .sort();
  }, [byDate, view.year, view.month, today]);

  const prevDisabled = view.year === todayYm.year && view.month === todayYm.month;
  const lastYm = ym(lastDate);
  const nextDisabled =
    view.year > lastYm.year ||
    (view.year === lastYm.year && view.month >= lastYm.month);

  const monthLabel = `${view.year} 年 ${view.month} 月`;
  const weekCount = Math.ceil(cells.length / 7);

  const navBtn =
    "flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-lg text-text transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text";

  function focusDay(date: string) {
    setFocusedDate(date);
    dayRefs.current.get(date)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

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

      {/* 整月格線 */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAY_HEAD.map((w) => (
            <div key={w} className="py-1 font-medium">
              {w}
            </div>
          ))}
        </div>

        <div
          className="mt-1 grid grid-cols-7 gap-1"
          style={{ gridTemplateRows: `repeat(${weekCount}, minmax(3.25rem, auto))` }}
        >
          {cells.map(({ date, inMonth }) => {
            const dayNum = Number(date.slice(8, 10));
            const total = byDate.get(date)?.length ?? 0;
            const avail = availByDate.get(date) ?? 0;
            const isPast = date < today;
            const isToday = date === today;
            const openable = inMonth && !isPast && total > 0;
            const fullOnly = total > 0 && avail === 0;
            const hasSelected = (byDate.get(date) ?? []).some((s) =>
              selected.includes(s.slotId),
            );
            const isFocused = date === focusedDate;

            if (!inMonth) {
              return (
                <div
                  key={date}
                  aria-hidden
                  className="flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg p-1 text-muted/40"
                >
                  <span className="text-xs">{dayNum}</span>
                </div>
              );
            }

            return (
              <button
                key={date}
                type="button"
                disabled={!openable}
                aria-pressed={isFocused}
                aria-label={`${view.month}/${dayNum},${
                  avail > 0
                    ? `可預約 ${avail} 個時段`
                    : fullOnly
                      ? "已額滿"
                      : isPast
                        ? "已過"
                        : "無可預約時段"
                }`}
                onClick={() => openable && focusDay(date)}
                className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-center transition focus:outline-none focus:ring-2 focus:ring-primary ${
                  isFocused
                    ? "border-primary ring-1 ring-primary"
                    : "border-border/60"
                } ${
                  openable
                    ? `${avail > 0 ? tintClass(avail) : "bg-status-full/10"} hover:border-primary/60`
                    : "cursor-default bg-bg"
                } ${isPast ? "opacity-50" : ""}`}
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
      </div>

      {/* 密度圖例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-status-available/20" />
          有位(數字為可預約時段數)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-status-full/10" />
          已額滿
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-border bg-bg" />
          無時段 / 已過
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          已選志願
        </span>
      </div>

      {/* 當月所有有時段的日期(整月,可捲動) */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">
          {monthLabel}可預約時段
          <span className="ml-2 font-normal text-muted">
            ({monthDates.length} 天有課)
          </span>
        </h3>

        {monthDates.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            這個月沒有可預約的時段,請切換到其他月份或改選課程。
          </p>
        ) : (
          <div className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto pr-1">
            {monthDates.map((date) => {
              const daySlots = byDate.get(date) ?? [];
              const isFocused = date === focusedDate;
              return (
                <section
                  key={date}
                  ref={(el) => {
                    if (el) dayRefs.current.set(date, el);
                    else dayRefs.current.delete(date);
                  }}
                  className={`scroll-mt-4 rounded-xl border p-3 transition ${
                    isFocused
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <h4 className="mb-2 text-sm font-medium">
                    {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
                    ({weekdayZh(date)})
                    <span className="ml-2 text-xs font-normal text-muted">
                      {daySlots.filter(isBookable).length} 個可選
                    </span>
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {daySlots.map((s) => (
                      <SlotChip
                        key={s.slotId}
                        slot={s}
                        selected={selected}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* 已選志願摘要(跨日跨月) */}
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

function SlotChip({
  slot: s,
  selected,
  onToggle,
}: {
  slot: BookableSlot;
  selected: string[];
  onToggle: (slotId: string) => void;
}) {
  const bookable = isBookable(s);
  if (!bookable) {
    return (
      <div
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
      type="button"
      aria-pressed={isSel}
      onClick={() => onToggle(s.slotId)}
      className={`relative flex min-h-11 items-center gap-3 rounded-xl border p-3 pl-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary ${
        isSel
          ? "border-primary bg-primary/10"
          : "border-border bg-surface hover:border-primary/50"
      }`}
    >
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
}
