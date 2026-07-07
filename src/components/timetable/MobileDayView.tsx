"use client";

/**
 * 手機版週曆(<768px):一次一天,日期 tab + 左右箭頭切換。
 * 格子改全寬列表卡:時間左、內容中、狀態 badge 右(設計規範 §3)。
 */

import { useState } from "react";
import type { WeekView } from "@/lib/timetable";
import { dayTagClasses, slotBadge, slotToneClasses } from "./slot-style";

export function MobileDayView({
  week,
  initialDate,
}: {
  week: WeekView;
  initialDate: string;
}) {
  const initialIdx = Math.max(
    0,
    week.days.findIndex((d) => d.date === initialDate),
  );
  const [idx, setIdx] = useState(initialIdx);
  const day = week.days[idx];

  return (
    <div className="flex flex-col gap-3">
      {/* 日期切換:左右箭頭 + 7 天 tab(touch target ≥44px) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="前一天"
          disabled={idx === 0}
          onClick={() => setIdx((v) => Math.max(0, v - 1))}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted disabled:opacity-40"
        >
          ‹
        </button>
        <div
          role="tablist"
          aria-label="選擇日期"
          className="grid flex-1 grid-cols-7 gap-0.5"
        >
          {week.days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg border text-xs leading-tight ${
                i === idx
                  ? "border-primary bg-primary/15 font-semibold text-primary"
                  : d.isPast
                    ? "border-border bg-surface text-muted"
                    : "border-border bg-surface text-text"
              }`}
            >
              <span>{d.weekdayLabel}</span>
              <span className={d.isToday ? "underline underline-offset-2" : ""}>
                {d.dateLabel}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="後一天"
          disabled={idx === week.days.length - 1}
          onClick={() => setIdx((v) => Math.min(week.days.length - 1, v + 1))}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted disabled:opacity-40"
        >
          ›
        </button>
      </div>

      {/* 當日標題 + 特殊日期標籤 */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-medium">
          {day.dateLabel}(週{day.weekdayLabel})
          {day.isToday && <span className="ml-1 text-sm text-primary">今天</span>}
        </h2>
        {day.tags.map((t) => (
          <span key={t.text} className={dayTagClasses(t.tone)}>
            {t.text}
          </span>
        ))}
      </div>

      {day.closed ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-status-closed/35 p-6 text-sm text-muted">
          本日公休{day.closed.reason ? `・${day.closed.reason}` : ""}
        </div>
      ) : day.slots.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          {day.openWindows.length === 0 ? "本日休息" : "本日尚無課程時段"}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {day.slots.map((s) => {
            const badge = slotBadge(s);
            return (
              <li
                key={s.id}
                className={`flex min-h-11 items-center gap-3 rounded-xl border p-3 ${slotToneClasses(s)}`}
              >
                <div className="w-12 shrink-0 text-right">
                  <p className="text-sm font-semibold leading-tight">
                    {s.startLabel}
                  </p>
                  <p className="text-xs leading-tight text-muted">
                    {s.endLabel}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="h-10 w-1 shrink-0 rounded-full"
                  style={{
                    background: s.resourceColor ?? "var(--color-muted)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.courseName}</p>
                  <p className="truncate text-xs text-muted">
                    {s.resourceName}・已約 {s.booked}/{s.capacity}
                  </p>
                </div>
                <span className={`shrink-0 ${badge.className}`}>
                  {badge.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
