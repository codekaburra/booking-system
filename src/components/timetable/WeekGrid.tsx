/**
 * 桌面版週曆格線(server component,純渲染)。
 *
 * 結構:外層 CSS Grid(時間軸 + 7 天欄);欄內 slot 依「分鐘 × PX_PER_MIN」
 * 絕對定位 —— 高度與 duration 等比,且同時段重疊的資源可並排(lane)。
 */

import type { DayView, TimetableSlotView, WeekView } from "@/lib/timetable";
import { restRanges } from "@/lib/timetable";
import { formatMinutes } from "@/lib/tz";
import { PX_PER_MIN, dayTagClasses, slotToneClasses } from "./slot-style";

const GRID_COLS = "3.25rem repeat(7, minmax(0, 1fr))";

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
      className={`absolute overflow-hidden rounded-md border py-1 pl-2.5 pr-1 text-[11px] leading-snug ${slotToneClasses(slot)}`}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
    >
      {/* 資源色:左側 4px 色條(不做整格填色,狀態色才是填色) */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: slot.resourceColor ?? "var(--color-muted)" }}
        title={slot.resourceName}
      />
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

function DayColumn({
  day,
  axisStartMin,
  axisEndMin,
}: {
  day: DayView;
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
      aria-label={`${day.dateLabel}(${day.weekdayLabel})`}
    >
      {hourLines.map((m) => (
        <div
          key={m}
          aria-hidden
          className="absolute inset-x-0 border-t border-border/60"
          style={{ top: (m - axisStartMin) * PX_PER_MIN }}
        />
      ))}

      {day.closed ? (
        // 整欄休(override closed):淡灰底 + 「休」+ reason(不能只靠色)。
        // ⚠️ PLAN §6:既有(尤其已約)slots 必須仍可見,讓老闆逐筆處理衝突 ——
        // closed 淡底墊在最底層,slots 照常疊在上面(標「休」)。
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-status-closed/35"
          />
          {day.slots.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center px-1">
              <span className="text-sm text-muted [writing-mode:vertical-rl] tracking-widest">
                休{day.closed.reason ? `・${day.closed.reason}` : ""}
              </span>
            </div>
          ) : (
            <div className="absolute inset-x-0 top-0 flex justify-center pt-1">
              <span className="rounded-full bg-status-closed/70 px-2 py-0.5 text-[10px] text-text">
                休{day.closed.reason ? `・${day.closed.reason}` : ""}
              </span>
            </div>
          )}
          {day.slots.map((s) => (
            <SlotCell key={s.id} slot={s} axisStartMin={axisStartMin} />
          ))}
        </>
      ) : (
        <>
          {/* 開放時段以外 = 休息陰影(含 special_hours 外的時段) */}
          {restRanges(day.openWindows, axisStartMin, axisEndMin).map((w) => (
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
          {day.openWindows.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-muted">休</span>
            </div>
          )}
          {day.slots.map((s) => (
            <SlotCell key={s.id} slot={s} axisStartMin={axisStartMin} />
          ))}
        </>
      )}
    </div>
  );
}

export function WeekGrid({ week }: { week: WeekView }) {
  const bodyHeight = (week.axisEndMin - week.axisStartMin) * PX_PER_MIN;
  const hours: number[] = [];
  for (let m = week.axisStartMin; m <= week.axisEndMin; m += 60) hours.push(m);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* 表頭:7 天日期 + 特殊日期標籤 */}
      <div
        className="grid border-b border-border"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <div aria-hidden />
        {week.days.map((d) => (
          <div
            key={d.date}
            className={`flex flex-col items-center gap-1 border-l border-border px-1 py-2 text-center ${
              d.isPast ? "opacity-60" : ""
            }`}
          >
            <span
              className={`text-sm ${
                d.isToday ? "font-semibold text-primary" : "font-medium"
              }`}
            >
              {d.dateLabel}({d.weekdayLabel})
            </span>
            {d.isToday && (
              <span className="text-[10px] leading-none text-primary">
                今天
              </span>
            )}
            {d.tags.map((t) => (
              <span key={t.text} className={dayTagClasses(t.tone)}>
                {t.text}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* 主體:時間軸 + 7 欄 */}
      <div className="grid" style={{ gridTemplateColumns: GRID_COLS }}>
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
        {week.days.map((d) => (
          <DayColumn
            key={d.date}
            day={d}
            axisStartMin={week.axisStartMin}
            axisEndMin={week.axisEndMin}
          />
        ))}
      </div>
    </div>
  );
}
