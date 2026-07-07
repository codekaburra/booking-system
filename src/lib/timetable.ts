/**
 * 週曆 view model 計算(P2,純函式、無 I/O)。
 *
 * date_overrides 優先權合約(見 supabase/migrations/0001_init.sql):
 *   1. date_overrides > availability_rules
 *   2. override 之間:closed > special_hours > extra_open
 *   3. 層級之間:資源級(resource_id 有值)> 全店級(resource_id = null)
 *
 * 本檔對合約的具體解讀(P5 slot 生成也應照此):
 * - 全店 closed        → 所有資源該日無開放(除非資源級 override 又把它打開)。
 * - 全店 special_hours → 各資源開放時段 = 自身 rules ∩ special 範圍
 *                        (店只開這段;沒排班的資源不會因此變成有開)。
 * - 全店 extra_open    → 各資源開放時段 ∪ extra 範圍。
 * - 資源級 closed        → 該資源整日休(蓋過全店級任何設定)。
 * - 資源級 special_hours → 該資源開放時段 = special 範圍(取代 rules 與全店級)。
 * - 資源級 extra_open    → 該資源開放時段 ∪ extra 範圍(全店 closed 時 = 只開這段)。
 * - 同層級同日多型並存時依 closed > special_hours > extra_open 處理。
 */

import type {
  AvailabilityRule,
  Course,
  DateOverride,
  DateOverrideType,
  Resource,
  Slot,
} from "@/types/db";
import {
  addDays,
  minutesOfTime,
  shortDateLabel,
  taipeiDateOf,
  taipeiMinutesOf,
  taipeiTimeOf,
  taipeiToday,
  weekdayOf,
  weekdayZh,
} from "@/lib/tz";

export interface TimeWindow {
  startMin: number;
  endMin: number;
}

export interface TimetableSlotView {
  id: string;
  courseName: string;
  resourceId: string;
  resourceName: string;
  /** 資源顏色(hex,來自 DB;僅用於色條/圓點,不做狀態填色) */
  resourceColor: string | null;
  date: string;
  /** 台北當日分鐘數(自 00:00 起算) */
  startMin: number;
  endMin: number;
  /** "10:00–11:30" */
  timeLabel: string;
  startLabel: string;
  endLabel: string;
  booked: number;
  capacity: number;
  isFull: boolean;
  /** 已開始(過去)的時段 → 灰、不可約 */
  isPast: boolean;
  /** 同日重疊時段的並排欄位(lane) */
  lane: number;
  laneCount: number;
}

export interface DayTag {
  text: string;
  tone: "closed" | "special";
}

export interface DayView {
  date: string;
  /** "7/14" */
  dateLabel: string;
  /** "二" */
  weekdayLabel: string;
  isToday: boolean;
  /** 整天已過去(台北日期 < 今天) */
  isPast: boolean;
  /** 該欄整日休(override closed;含 reason 顯示) */
  closed: { reason: string | null } | null;
  /** 頂部標籤(公休/請假/特殊時段 reason) */
  tags: DayTag[];
  /** 顯示中資源的有效開放時段聯集(範圍外 = 休息陰影) */
  openWindows: TimeWindow[];
  slots: TimetableSlotView[];
}

export interface WeekView {
  weekStart: string;
  days: DayView[];
  /** 時間軸範圍(台北分鐘數;由當週 slots + rules/overrides 推導,非 hardcode) */
  axisStartMin: number;
  axisEndMin: number;
}

// ---------------------------------------------------------------------------
// 時段窗運算
// ---------------------------------------------------------------------------

/** 排序 + 合併重疊/相鄰的時段窗 */
export function mergeWindows(ws: TimeWindow[]): TimeWindow[] {
  const sorted = ws
    .filter((w) => w.endMin > w.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const out: TimeWindow[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, w.endMin);
    } else {
      out.push({ ...w });
    }
  }
  return out;
}

function intersectWindows(ws: TimeWindow[], clip: TimeWindow): TimeWindow[] {
  return ws
    .map((w) => ({
      startMin: Math.max(w.startMin, clip.startMin),
      endMin: Math.min(w.endMin, clip.endMin),
    }))
    .filter((w) => w.endMin > w.startMin);
}

/** [start, end) 範圍內、openWindows 以外的區段(= 休息陰影) */
export function restRanges(
  openWindows: TimeWindow[],
  startMin: number,
  endMin: number,
): TimeWindow[] {
  const out: TimeWindow[] = [];
  let cursor = startMin;
  for (const w of mergeWindows(openWindows)) {
    if (w.startMin > cursor) {
      out.push({ startMin: cursor, endMin: Math.min(w.startMin, endMin) });
    }
    cursor = Math.max(cursor, w.endMin);
  }
  if (cursor < endMin) out.push({ startMin: cursor, endMin });
  return out.filter((w) => w.endMin > w.startMin);
}

function windowOf(o: DateOverride): TimeWindow {
  return {
    startMin: minutesOfTime(o.start_time ?? "00:00"),
    endMin: minutesOfTime(o.end_time ?? "24:00"),
  };
}

// ---------------------------------------------------------------------------
// 單一資源 × 單日:套用 override 優先權後的有效開放時段
// ---------------------------------------------------------------------------

interface ResourceDayAvailability {
  windows: TimeWindow[];
  /** 被 override 明確關閉(≠ 只是當天沒排班) */
  closed: boolean;
  closedReason: string | null;
  specialReason: string | null;
}

export function resolveResourceDay(
  resourceId: string,
  date: string,
  rules: AvailabilityRule[],
  overrides: DateOverride[],
): ResourceDayAvailability {
  const wd = weekdayOf(date);
  let windows = mergeWindows(
    rules
      .filter((r) => r.resource_id === resourceId && r.weekday === wd)
      .map((r) => ({
        startMin: minutesOfTime(r.start_time),
        endMin: minutesOfTime(r.end_time),
      })),
  );

  const dayOvs = overrides.filter((o) => o.date === date);
  const find = (rid: string | null, type: DateOverrideType) =>
    dayOvs.find((o) => o.resource_id === rid && o.type === type);

  let closed = false;
  let closedReason: string | null = null;
  let specialReason: string | null = null;

  // --- 全店級(closed > special_hours > extra_open)---
  const shopClosed = find(null, "closed");
  if (shopClosed) {
    windows = [];
    closed = true;
    closedReason = shopClosed.reason;
  } else {
    const shopSpecial = find(null, "special_hours");
    if (shopSpecial) {
      windows = intersectWindows(windows, windowOf(shopSpecial));
      specialReason = shopSpecial.reason;
    }
    const shopExtra = find(null, "extra_open");
    if (shopExtra) windows = mergeWindows([...windows, windowOf(shopExtra)]);
  }

  // --- 資源級(> 全店級)---
  const resClosed = find(resourceId, "closed");
  if (resClosed) {
    windows = [];
    closed = true;
    closedReason = resClosed.reason;
    specialReason = null;
  } else {
    const resSpecial = find(resourceId, "special_hours");
    if (resSpecial) {
      windows = [windowOf(resSpecial)];
      closed = false;
      closedReason = null;
      specialReason = resSpecial.reason;
    }
    const resExtra = find(resourceId, "extra_open");
    if (resExtra) {
      windows = mergeWindows([...windows, windowOf(resExtra)]);
      closed = false;
      closedReason = null;
    }
  }

  return { windows, closed, closedReason, specialReason };
}

// ---------------------------------------------------------------------------
// 重疊時段 → 並排 lane 配置(區間圖 greedy)
// ---------------------------------------------------------------------------

function assignLanes(slots: TimetableSlotView[]): void {
  let clusterStart = 0;
  let laneEnds: number[] = [];
  let activeEnd = -1;

  const closeCluster = (endIdx: number) => {
    for (let j = clusterStart; j < endIdx; j++) {
      slots[j].laneCount = Math.max(laneEnds.length, 1);
    }
  };

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (i > 0 && s.startMin >= activeEnd) {
      closeCluster(i);
      clusterStart = i;
      laneEnds = [];
    }
    let lane = laneEnds.findIndex((e) => e <= s.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.endMin);
    } else {
      laneEnds[lane] = s.endMin;
    }
    s.lane = lane;
    activeEnd = Math.max(activeEnd, s.endMin);
  }
  closeCluster(slots.length);
}

// ---------------------------------------------------------------------------
// 週 view model
// ---------------------------------------------------------------------------

export interface BuildWeekParams {
  /** 台北週一 "YYYY-MM-DD" */
  weekStart: string;
  /** 顯示中的資源(整店視角 = 全部;單一資源視角 = 一個) */
  resources: Resource[];
  /** 是否單一資源視角(影響標籤呈現) */
  singleView: boolean;
  courses: Course[];
  slots: Slot[];
  overrides: DateOverride[];
  rules: AvailabilityRule[];
  now?: Date;
}

export function buildWeekView(p: BuildWeekParams): WeekView {
  const now = p.now ?? new Date();
  const today = taipeiToday(now);
  const courseById = new Map(p.courses.map((c) => [c.id, c]));
  const resourceById = new Map(p.resources.map((r) => [r.id, r]));

  // slots 依台北日期歸屬分組(timestamptz → Asia/Taipei 當地日期)
  const slotsByDate = new Map<string, Slot[]>();
  for (const s of p.slots) {
    if (!resourceById.has(s.resource_id)) continue; // 非顯示中資源
    const d = taipeiDateOf(new Date(s.starts_at));
    const list = slotsByDate.get(d);
    if (list) list.push(s);
    else slotsByDate.set(d, [s]);
  }

  const days: DayView[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(p.weekStart, i);

    const perResource = p.resources.map((r) => ({
      resource: r,
      avail: resolveResourceDay(r.id, date, p.rules, p.overrides),
    }));
    const openWindows = mergeWindows(
      perResource.flatMap((x) => x.avail.windows),
    );

    // 整欄休:所有顯示中的資源都被 override 關閉且無任何開放時段
    const shopClosedOv = p.overrides.find(
      (o) => o.date === date && o.resource_id === null && o.type === "closed",
    );
    const allClosed =
      perResource.length > 0 &&
      openWindows.length === 0 &&
      perResource.every((x) => x.avail.closed);
    const closed: DayView["closed"] = allClosed
      ? {
          reason: p.singleView
            ? (perResource[0].avail.closedReason ?? shopClosedOv?.reason ?? null)
            : (shopClosedOv?.reason ?? perResource[0].avail.closedReason ?? null),
        }
      : null;

    const tags: DayTag[] = [];
    if (closed) {
      tags.push({
        text: closed.reason ? `休・${closed.reason}` : "公休",
        tone: "closed",
      });
    } else if (shopClosedOv) {
      // 全店休但個別資源被資源級 override 打開的罕見情況
      tags.push({
        text: shopClosedOv.reason ? `全店休・${shopClosedOv.reason}` : "全店休",
        tone: "closed",
      });
    }
    // special_hours reason 標籤(全店或資源級,去重)
    const specialReasons = new Set(
      perResource
        .map((x) => x.avail.specialReason)
        .filter((r): r is string => Boolean(r)),
    );
    for (const r of specialReasons) tags.push({ text: r, tone: "special" });
    // 整店視角:個別資源請假/維修標籤
    if (!p.singleView && !closed) {
      for (const x of perResource) {
        if (x.avail.closed) {
          tags.push({
            text: x.avail.closedReason
              ? `${x.resource.name}・${x.avail.closedReason}`
              : `${x.resource.name}休`,
            tone: "closed",
          });
        }
      }
    }

    const daySlots: TimetableSlotView[] = (slotsByDate.get(date) ?? [])
      .map((s) => {
        const start = new Date(s.starts_at);
        const end = new Date(s.ends_at);
        const resource = resourceById.get(s.resource_id)!;
        const startMin = taipeiMinutesOf(start);
        let endMin = taipeiMinutesOf(end);
        if (endMin <= startMin) endMin = 24 * 60; // 跨日 slot 防呆(裁到當日底)
        const startLabel = taipeiTimeOf(start);
        const endLabel = taipeiTimeOf(end);
        return {
          id: s.id,
          courseName: courseById.get(s.course_id)?.name ?? "課程",
          resourceId: resource.id,
          resourceName: resource.name,
          resourceColor: resource.color,
          date,
          startMin,
          endMin,
          timeLabel: `${startLabel}–${endLabel}`,
          startLabel,
          endLabel,
          booked: s.booked_count,
          capacity: s.capacity,
          isFull: s.booked_count >= s.capacity,
          isPast: start.getTime() <= now.getTime(),
          lane: 0,
          laneCount: 1,
        };
      })
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    assignLanes(daySlots);

    days.push({
      date,
      dateLabel: shortDateLabel(date),
      weekdayLabel: weekdayZh(date),
      isToday: date === today,
      isPast: date < today,
      closed,
      tags,
      openWindows,
      slots: daySlots,
    });
  }

  // 時間軸:由當週 slots + 有效開放時段推導,取整點
  let minM = Infinity;
  let maxM = -Infinity;
  for (const d of days) {
    for (const w of d.openWindows) {
      minM = Math.min(minM, w.startMin);
      maxM = Math.max(maxM, w.endMin);
    }
    for (const s of d.slots) {
      minM = Math.min(minM, s.startMin);
      maxM = Math.max(maxM, s.endMin);
    }
  }
  if (!Number.isFinite(minM) || !Number.isFinite(maxM)) {
    minM = 9 * 60;
    maxM = 18 * 60;
  }
  const axisStartMin = Math.floor(minM / 60) * 60;
  const axisEndMin = Math.max(Math.ceil(maxM / 60) * 60, axisStartMin + 60);

  return { weekStart: p.weekStart, days, axisStartMin, axisEndMin };
}
