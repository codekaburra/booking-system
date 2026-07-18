"use client";

/**
 * 模式 A 步驟②:選時段(設計規範 booking-ui-extensions §8a,手機直列式)。
 *
 * 結構(由上而下):
 * 1. 標題列:「選擇日期」+ 月份標籤「7月 2026 ›」→ 點開跳日月曆彈層(復用 MonthPicker)。
 * 2. 單週日期橫條:‹ › 換週;每格 = 週幾 + 日 + 當日可約數(數字必顯示,不單靠顏色)。
 *    選中日 = --color-primary-deep 實底圓角 pill + 白字(白字對比 ≥4.5:1,見 globals.css)。
 * 3. 時段直列卡片(選中日的全部未來時段):時間左、「尚餘 X 位」右(--status-available-strong);
 *    已額滿 = 灰卡 disabled 仍顯示(刪節線 + 「已額滿」pill,不單靠顏色);
 *    選中 = 深色框(primary-deep)+ 志願序號圓標。
 *
 * 多志願保留(§4/§8a):卡片可跨日複選,勾選順序 = 志願序(togglePreference 在上層);
 * 底部固定摘要列(chips + 下一步 CTA)由 BookFlow 負責 —— 此元件只管日期與時段選取。
 *
 * RWD:375px 手機上週條以 -mx-4 出血滿版,7 格每格 ≥44px 寬、56px 高(touch target)。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { preferenceOrderOf } from "@/lib/booking/preferences";
import { addDays, mondayOf, shortDateLabel, weekdayZh } from "@/lib/tz";
import type { BookableSlot } from "@/lib/booking/types";
import { MonthPicker } from "./MonthPicker";

interface Props {
  /** 該課程未來的**全部** slots(含已額滿);可勾選 = booked < capacity */
  slots: BookableSlot[];
  /** 已選 slotId(志願序 = index) */
  selected: string[];
  onToggle: (slotId: string) => void;
  /** 台北今天 "YYYY-MM-DD"(server 計算,避免 hydration 時區偏差) */
  today: string;
}

/** 有空位可勾選?(false = 未來但已額滿 → disabled「已額滿」卡) */
function isBookable(s: BookableSlot): boolean {
  return s.booked < s.capacity;
}

export function SlotPicker({ slots, selected, onToggle, today }: Props) {
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

  // 當日「可預約(有空位)」數 —— 週條格內數字用
  const availByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) {
      if (isBookable(s)) m.set(s.date, (m.get(s.date) ?? 0) + 1);
    }
    return m;
  }, [slots]);

  // 範圍界線(換週導覽 disable 用);含已額滿的最後一天
  const lastDate = useMemo(
    () => (slots.length ? slots[slots.length - 1].date : today),
    [slots, today],
  );

  // 預設:今天所在週 + 今天選中(§8a 驗收基準;當日無時段則列表顯示空狀態)
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [monthOpen, setMonthOpen] = useState(false);

  // 彈層 a11y:開啟時 focus 移入面板、Tab 困在面板內、鎖 body scroll;
  // 關閉(Esc/遮罩/✕/選日,皆走 setMonthOpen(false) → cleanup)後 focus 回月份標籤。
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!monthOpen) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current; // effect 開始時捕捉,供 cleanup 還原 focus
    panel?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMonthOpen(false);
        return;
      }
      if (e.key === "Tab" && panel) {
        const els = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [monthOpen]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const prevDisabled = weekStart <= mondayOf(today);
  const nextDisabled = weekStart >= mondayOf(lastDate);

  // 月份標籤取該週中段(週四)所屬月,週跨月時較符合直覺
  const labelDate = addDays(weekStart, 3);
  const monthLabel = `${Number(labelDate.slice(5, 7))}月 ${labelDate.slice(0, 4)}`;

  const daySlots = byDate.get(selectedDate) ?? [];

  function jumpTo(date: string) {
    setSelectedDate(date);
    setWeekStart(mondayOf(date));
    setMonthOpen(false);
  }

  // 44px touch target(w-11);負邊距只往「內側」收(外緣貼齊容器,避免 375px 溢出),
  // 版面淨佔 32px、日期格維持 ≥44px;relative z-10 讓 12px 重疊區由箭頭優先接收點擊
  const weekNavBase =
    "relative z-10 flex w-11 shrink-0 items-center justify-center text-lg text-muted transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg";
  const weekNavPrev = `${weekNavBase} -mr-3`;
  const weekNavNext = `${weekNavBase} -ml-3`;

  return (
    <div className="flex flex-col gap-4">
      {/* 標題列 + 月份標籤(開跳日月曆) */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">選擇日期</h3>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={monthOpen}
          onClick={() => setMonthOpen(true)}
          className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-text transition hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {monthLabel}
          <span aria-hidden className="text-muted">
            ›
          </span>
        </button>
      </div>

      {/* 單週日期橫條(手機出血滿版:7 格每格 ≥44px 寬) */}
      <div className="-mx-4 flex items-stretch sm:mx-0">
        <button
          type="button"
          aria-label="上一週"
          disabled={prevDisabled}
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className={weekNavPrev}
        >
          ‹
        </button>
        <div className="grid flex-1 grid-cols-7 gap-0 sm:gap-1">
          {weekDays.map((date) => {
            const dayNum = Number(date.slice(8, 10));
            const total = byDate.get(date)?.length ?? 0;
            const avail = availByDate.get(date) ?? 0;
            const isPast = date < today;
            const isToday = date === today;
            const openable = !isPast && total > 0;
            const fullOnly = total > 0 && avail === 0;
            const isActive = date === selectedDate;
            const hasSelected = (byDate.get(date) ?? []).some((s) =>
              selected.includes(s.slotId),
            );

            return (
              <button
                key={date}
                type="button"
                // isActive 時保持 enabled(即使該日無時段):避免選中日突然變
                // disabled 令鍵盤焦點丟失;onClick 內有 openable 守衛,點了無害
                disabled={!openable && !isActive}
                aria-pressed={isActive}
                aria-label={`${Number(date.slice(5, 7))}/${dayNum}(週${weekdayZh(date)}),${
                  avail > 0
                    ? `可預約 ${avail} 個時段`
                    : fullOnly
                      ? "已額滿"
                      : "無可預約時段"
                }`}
                onClick={() => openable && setSelectedDate(date)}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "bg-primary-deep text-surface"
                    : openable
                      ? "text-text hover:bg-primary/10"
                      : "cursor-not-allowed text-muted opacity-50"
                }`}
              >
                <span
                  className={`text-[10px] leading-none ${
                    isActive ? "text-surface/80" : "text-muted"
                  }`}
                >
                  週{weekdayZh(date)}
                </span>
                <span
                  className={`text-sm leading-none ${
                    isActive
                      ? "font-semibold"
                      : isToday
                        ? "font-bold text-primary"
                        : "font-medium"
                  }`}
                >
                  {dayNum}
                </span>
                <span
                  className={`text-[10px] leading-none ${
                    isActive
                      ? "text-surface/80"
                      : avail > 0
                        ? "text-status-available-strong"
                        : fullOnly
                          ? "text-status-full-strong"
                          : "text-muted"
                  }`}
                >
                  {avail > 0 ? `${avail}位` : fullOnly ? "滿" : "–"}
                </span>
                {hasSelected && (
                  <span
                    aria-hidden
                    className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-surface" : "bg-primary-deep"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="下一週"
          disabled={nextDisabled}
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className={weekNavNext}
        >
          ›
        </button>
      </div>

      {/* 選中日的時段直列卡片 */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          {shortDateLabel(selectedDate)}(週{weekdayZh(selectedDate)})時段
        </h3>
        {daySlots.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            這天沒有時段 —— 請點上方其他日期,或點「{monthLabel}」跳到其他週。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {daySlots.map((s) => {
              const bookable = isBookable(s);
              if (!bookable) {
                // 未來但已額滿:disabled 灰卡仍顯示(§8a;刪節線 + 文字,不單靠顏色)
                return (
                  <div
                    key={s.slotId}
                    aria-disabled
                    className="relative flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface p-3.5 pl-4 opacity-60"
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
                  className={`relative flex min-h-14 items-center gap-3 rounded-xl border p-3.5 pl-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary ${
                    isSel
                      ? "border-primary-deep bg-primary/10 ring-1 ring-primary-deep"
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
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-deep text-xs font-semibold text-surface"
                    >
                      {order}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{s.timeLabel}</span>
                    <span className="block text-xs text-muted">{s.resourceName}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-status-available-strong">
                    尚餘 {s.capacity - s.booked} 位
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

      {/* 跳日月曆彈層(手機 bottom sheet / 桌面置中 dialog) */}
      {monthOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="選擇日期(月曆)"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
        >
          {/* 背景遮罩(點擊關閉) */}
          <button
            type="button"
            aria-label="關閉月曆"
            onClick={() => setMonthOpen(false)}
            className="absolute inset-0 cursor-default bg-text/40"
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-xl focus:outline-none sm:max-w-md sm:rounded-2xl sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">跳到日期</h3>
              <button
                type="button"
                aria-label="關閉"
                onClick={() => setMonthOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-bg hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                ✕
              </button>
            </div>
            <MonthPicker
              slots={slots}
              selected={selected}
              today={today}
              selectedDate={selectedDate}
              onPick={jumpTo}
            />
          </div>
        </div>
      )}
    </div>
  );
}
