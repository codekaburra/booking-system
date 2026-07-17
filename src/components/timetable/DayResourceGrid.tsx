"use client";

/**
 * 依資源分欄的「日檢視」—— 欄 = 資源(教練/球場…)、列 = 時間。
 *
 * 結構:單日;左為時間軸,每個資源各一欄;slot 依「分鐘 × PX_PER_MIN」絕對定位,
 * 高度與 duration 等比。相較週檢視把 N 個資源塞進單日的窄 lane,這裡一眼看完
 * 當天各資源狀況 —— 分店教練/場地多時特別有用。
 *
 * ⚠️ 分店合約:`week` 必須是**單一分店**資料算出的 WeekView(見 src/lib/timetable.ts
 * 檔頭);本元件只負責呈現,不做任何分店過濾。
 *
 * 欄多時整個網格在自己的容器內橫向捲動(頁面本體不會橫向溢出),手機亦可用。
 */

import { useState } from "react";
import type { ResourceColumnView, TimetableSlotView, WeekView } from "@/lib/timetable";
import { restRanges } from "@/lib/timetable";
import { formatMinutes } from "@/lib/tz";
import { PX_PER_MIN, dayTagClasses, slotToneClasses } from "./slot-style";

function SlotCell({
  slot,
  axisStartMin,
}: {
  slot: TimetableSlotView;
  axisStartMin: number;
}) {
  const top = (slot.startMin - axisStartMin) * PX_PER_MIN;
  const height = Math.max((slot.endMin - slot.startMin) * PX_PER_MIN, 44);
  const leftPct = (slot.lane / slot.laneCount) * 100;
  const widthPct = 100 / slot.laneCount;

  return (
    <div
      className={`absolute overflow-hidden rounded-md border py-1 pl-2 pr-1 text-[11px] leading-snug ${slotToneClasses(slot)}`}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
    >
      <p className="font-medium">{slot.timeLabel}</p>
      <p className="truncate">{slot.courseName}</p>
      <p className="flex flex-wrap items-center gap-x-1">
        <span>
          已約 {slot.booked}/{slot.capacity}
        </span>
        {slot.isPast ? (
          <span>・已過</span>
        ) : slot.isFull ? (
          <span className="rounded-full bg-status-full/25 px-1.5 font-medium text-status-full-strong">
            滿
          </span>
        ) : null}
      </p>
    </div>
  );
}

function ResourceColumn({
  column,
  axisStartMin,
  axisEndMin,
}: {
  column: ResourceColumnView;
  axisStartMin: number;
  axisEndMin: number;
}) {
  const height = (axisEndMin - axisStartMin) * PX_PER_MIN;
  const hourLines: number[] = [];
  for (let m = axisStartMin + 60; m < axisEndMin; m += 60) hourLines.push(m);

  return (
    <div
      className="relative border-l border-border"
      style={{ height }}
      aria-label={column.name}
    >
      {hourLines.map((m) => (
        <div
          key={m}
          aria-hidden
          className="absolute inset-x-0 border-t border-border/60"
          style={{ top: (m - axisStartMin) * PX_PER_MIN }}
        />
      ))}

      {column.closed ? (
        <>
          <div aria-hidden className="absolute inset-0 bg-status-closed/35" />
          {column.slots.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center px-1">
              <span className="text-sm text-muted [writing-mode:vertical-rl] tracking-widest">
                休{column.closedReason ? `・${column.closedReason}` : ""}
              </span>
            </div>
          ) : (
            <div className="absolute inset-x-0 top-0 flex justify-center pt-1">
              <span className="rounded-full bg-status-closed/70 px-2 py-0.5 text-[10px] text-text">
                休{column.closedReason ? `・${column.closedReason}` : ""}
              </span>
            </div>
          )}
          {column.slots.map((s) => (
            <SlotCell key={s.id} slot={s} axisStartMin={axisStartMin} />
          ))}
        </>
      ) : (
        <>
          {restRanges(column.openWindows, axisStartMin, axisEndMin).map((w) => (
            <div
              key={w.startMin}
              aria-hidden
              className="absolute inset-x-0 bg-status-closed/25"
              style={{
                top: (w.startMin - axisStartMin) * PX_PER_MIN,
                height: (w.endMin - w.startMin) * PX_PER_MIN,
              }}
            />
          ))}
          {column.openWindows.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-muted">休</span>
            </div>
          )}
          {column.slots.map((s) => (
            <SlotCell key={s.id} slot={s} axisStartMin={axisStartMin} />
          ))}
        </>
      )}
    </div>
  );
}

export function DayResourceGrid({
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

  const bodyHeight = (week.axisEndMin - week.axisStartMin) * PX_PER_MIN;
  const hours: number[] = [];
  for (let m = week.axisStartMin; m <= week.axisEndMin; m += 60) hours.push(m);

  const gridCols = `3.25rem repeat(${day.resources.length}, minmax(7rem, 1fr))`;

  return (
    <div className="flex flex-col gap-3">
      {/* 日期切換:左右箭頭 + 7 天 tab 帶 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="前一天"
          disabled={idx === 0}
          onClick={() => setIdx((v) => Math.max(0, v - 1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted disabled:opacity-40"
        >
          ‹
        </button>
        <div
          role="tablist"
          aria-label="選擇日期"
          className="flex flex-1 gap-1 overflow-x-auto"
        >
          {week.days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              className={`flex min-h-11 flex-1 shrink-0 flex-col items-center justify-center rounded-lg border px-2 text-xs leading-tight ${
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
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted disabled:opacity-40"
        >
          ›
        </button>
      </div>

      {/* 當日標籤 */}
      {day.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {day.tags.map((t) => (
            <span key={t.text} className={dayTagClasses(t.tone)}>
              {t.text}
            </span>
          ))}
        </div>
      )}

      {/* 依資源分欄的網格(欄多時可橫向捲動) */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <div style={{ minWidth: `calc(3.25rem + ${day.resources.length} * 7rem)` }}>
          {/* 表頭:資源名 + 色點 */}
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div aria-hidden />
            {day.resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-center gap-1.5 border-l border-border px-1 py-2 text-center text-sm font-medium"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: r.color ?? "var(--color-muted)" }}
                />
                <span className="truncate">{r.name}</span>
              </div>
            ))}
          </div>

          {/* 主體:時間軸 + 各資源欄 */}
          <div className="grid" style={{ gridTemplateColumns: gridCols }}>
            <div className="relative" style={{ height: bodyHeight }}>
              {hours.map((m) => (
                <span
                  key={m}
                  className={`absolute right-1.5 text-[11px] text-muted ${
                    m > week.axisStartMin ? "-translate-y-1/2" : "translate-y-0.5"
                  }`}
                  style={{ top: (m - week.axisStartMin) * PX_PER_MIN }}
                >
                  {formatMinutes(m)}
                </span>
              ))}
            </div>
            {day.resources.map((r) => (
              <ResourceColumn
                key={r.id}
                column={r}
                axisStartMin={week.axisStartMin}
                axisEndMin={week.axisEndMin}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
