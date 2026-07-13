/**
 * Slot(DB 列)→ BookableSlot(表單 view model)轉換(P3)。
 *
 * server 端查到 slots + resources 後,在此組成表單/狀態頁需要的顯示欄位
 * (日期分組、繁中日期、24 小時制時間、資源色)。時間一律以 Asia/Taipei 呈現。
 */

import type { Resource, Slot } from "@/types/db";
import {
  shortDateLabel,
  taipeiDateOf,
  taipeiMinutesOf,
  taipeiTimeOf,
  weekdayZh,
} from "@/lib/tz";
import type { BookableSlot } from "./types";

/** Slot + 對應 resource → BookableSlot(資源缺失時以 dash 佔位,不中斷) */
export function toBookableSlot(
  slot: Slot,
  resource: Resource | undefined,
): BookableSlot {
  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at);
  const date = taipeiDateOf(start);
  return {
    slotId: slot.id,
    courseId: slot.course_id,
    resourceId: slot.resource_id,
    resourceName: resource?.name ?? "—",
    resourceColor: resource?.color ?? null,
    date,
    dayLabel: `${shortDateLabel(date)}(${weekdayZh(date)})`,
    timeLabel: `${taipeiTimeOf(start)}–${taipeiTimeOf(end)}`,
    startMin: taipeiMinutesOf(start),
    capacity: slot.capacity,
    booked: slot.booked_count,
  };
}

/** slots + resources → BookableSlot[](依 starts_at 已排序;維持順序) */
export function toBookableSlots(
  slots: readonly Slot[],
  resources: readonly Resource[],
): BookableSlot[] {
  const byId = new Map(resources.map((r) => [r.id, r]));
  return slots.map((s) => toBookableSlot(s, byId.get(s.resource_id)));
}
