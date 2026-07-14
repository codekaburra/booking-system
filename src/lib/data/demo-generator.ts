/**
 * Demo 資料的「今日相對」RICH 產生器(P3 preview 用)。
 *
 * ⚠️ 這是 preview 專用的**豐富**資料產生器,刻意與 `supabase/seed.sql` 分家:
 *   - seed.sql 仍是最小、可對映真實 DB 的正式種子(3 教練 / 3 課程 / 幾筆固定 slot)。
 *   - 本檔則以「今天(Asia/Taipei)」為基準,程式化生成 today … today+45 天的 slots,
 *     讓月曆檢視有真實密度(近幾天幾乎全滿、之後漸鬆)。
 *
 * 純函式、無 I/O、不 import server-only:可被 demo.ts 與離線驗證腳本共用。
 *
 * 決定性(determinism):所有隨機皆走 seeded PRNG,key = 日期 + 資源 index (+ 用途),
 *   給定同一個 `today` 產生的資料完全一致(避免 SSR/CSR hydration 不一致、可在測試中斷言)。
 */

import type {
  AvailabilityRule,
  Course,
  DateOverride,
  Resource,
  Slot,
} from "@/types/db";
import { addDays, formatMinutes, weekdayOf } from "@/lib/tz";
import { resolveResourceDay } from "@/lib/timetable";

/** 產生範圍:今天起算天數(含 0);today … today+RANGE_DAYS */
export const RANGE_DAYS = 45;
/** 覆蓋此 slug 的一致性用種子(嵌在 PRNG key 內) */
const SEED = "booking-demo-v1";

const SEEDED_AT = "2026-07-06T00:00:00+08:00";

export const RES = {
  xiaoming: "11111111-1111-4111-8111-000000000001",
  ahua: "11111111-1111-4111-8111-000000000002",
  peipei: "11111111-1111-4111-8111-000000000003",
} as const;

export const COURSE = {
  private90: "22222222-2222-4222-8222-000000000001",
  group120: "22222222-2222-4222-8222-000000000002",
  kids60: "22222222-2222-4222-8222-000000000003",
} as const;

export const resources: Resource[] = [
  {
    id: RES.xiaoming,
    type: "instructor",
    name: "小明教練",
    photo: null,
    color: "#6b9bb5",
    is_active: true,
    gcal_calendar_id: null,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: RES.ahua,
    type: "instructor",
    name: "阿華教練",
    photo: null,
    color: "#8a9a5b",
    is_active: true,
    gcal_calendar_id: null,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: RES.peipei,
    type: "instructor",
    name: "佩佩教練",
    photo: null,
    color: "#c2967a",
    is_active: true,
    gcal_calendar_id: null,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
];

export const courses: Course[] = [
  {
    id: COURSE.private90,
    name: "私人課(90 分)",
    duration_min: 90,
    capacity: 1,
    price: 2800,
    is_active: true,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: COURSE.group120,
    name: "團體課(120 分)",
    duration_min: 120,
    capacity: 8,
    price: 1200,
    is_active: true,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: COURSE.kids60,
    name: "兒童體驗課(60 分)",
    duration_min: 60,
    capacity: 6,
    price: 900,
    is_active: true,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
];

/**
 * 每個資源可教哪些課(resource_courses 對映表 P6 才建；此處先在產生器內合理指定)。
 * 產生器每天為每個資源挑其中一門課,鋪滿當天有效開放時段。
 */
/** resource_courses 對映(P5 設定頁 / P6 生成器共用) */
export const resourceCourseLinks: { resource_id: string; course_id: string }[] = [
  { resource_id: RES.xiaoming, course_id: COURSE.private90 },
  { resource_id: RES.xiaoming, course_id: COURSE.group120 },
  { resource_id: RES.ahua, course_id: COURSE.private90 },
  { resource_id: RES.ahua, course_id: COURSE.group120 },
  { resource_id: RES.peipei, course_id: COURSE.kids60 },
  { resource_id: RES.peipei, course_id: COURSE.private90 },
];

const resourceCourses: Record<string, string[]> = Object.fromEntries(
  Object.values(RES).map((rid) => [
    rid,
    resourceCourseLinks.filter((l) => l.resource_id === rid).map((l) => l.course_id),
  ]),
);

let ruleSeq = 0;
function rule(
  resource_id: string,
  weekday: number,
  start_time: string,
  end_time: string,
): AvailabilityRule {
  ruleSeq += 1;
  return {
    id: `66666666-6666-4666-8666-${String(ruleSeq).padStart(12, "0")}`,
    resource_id,
    weekday,
    start_time: `${start_time}:00`,
    end_time: `${end_time}:00`,
    created_at: SEEDED_AT,
  };
}

export const availabilityRules: AvailabilityRule[] = [
  // 小明:週二~週五 10:00–18:00、週六 09:00–17:00
  rule(RES.xiaoming, 2, "10:00", "18:00"),
  rule(RES.xiaoming, 3, "10:00", "18:00"),
  rule(RES.xiaoming, 4, "10:00", "18:00"),
  rule(RES.xiaoming, 5, "10:00", "18:00"),
  rule(RES.xiaoming, 6, "09:00", "17:00"),
  // 阿華:週三~週六 10:00–18:00、週日 10:00–16:00
  rule(RES.ahua, 3, "10:00", "18:00"),
  rule(RES.ahua, 4, "10:00", "18:00"),
  rule(RES.ahua, 5, "10:00", "18:00"),
  rule(RES.ahua, 6, "10:00", "18:00"),
  rule(RES.ahua, 0, "10:00", "16:00"),
  // 佩佩:週二 13:00–18:00、週六/週日 09:00–17:00
  rule(RES.peipei, 2, "13:00", "18:00"),
  rule(RES.peipei, 6, "09:00", "17:00"),
  rule(RES.peipei, 0, "09:00", "17:00"),
];

// 有排班的星期集合(全體 / 阿華),供挑選「看得到效果」的 override 日期。
const shiftWeekdays = new Set(availabilityRules.map((r) => r.weekday));
const ahuaShiftWeekdays = new Set(
  availabilityRules.filter((r) => r.resource_id === RES.ahua).map((r) => r.weekday),
);

/** 自 startOffset 起往後找第一個「該星期有排班」的日期(找不到則退回該 offset)。 */
function firstOpenDateFrom(
  today: string,
  startOffset: number,
  hasShift: (weekday: number) => boolean,
  avoid?: string,
): string {
  for (let d = startOffset; d <= startOffset + 7; d++) {
    const date = addDays(today, d);
    if (date === avoid) continue;
    if (hasShift(weekdayOf(date))) return date;
  }
  return addDays(today, startOffset);
}

/**
 * date_overrides:相對今天、且**保證看得到效果**的兩個示範 override,
 * 讓 /timetable 與 /book 都能持續展示:
 *   1. 全店 special_hours(≈today+3:上午公休、只開下午)—— 落在有排班的日子才會被裁切。
 *   2. 資源級 closed(≈today+5:阿華請假整天)—— 落在阿華本有排班的日子才看得出「休」。
 * 由於固定偏移可能撞到公休星期(週一無人排班),此處自該偏移往後找最近的有排班日,
 * 仍為決定性(給定 today 唯一)。
 */
export function buildDateOverrides(today: string): DateOverride[] {
  const specialDate = firstOpenDateFrom(today, 3, (wd) => shiftWeekdays.has(wd));
  const leaveDate = firstOpenDateFrom(
    today,
    5,
    (wd) => ahuaShiftWeekdays.has(wd),
    specialDate,
  );
  return [
    {
      id: "77777777-7777-4777-8777-000000000001",
      date: specialDate,
      resource_id: null,
      type: "special_hours",
      start_time: "13:00:00",
      end_time: "18:00:00",
      reason: "設備保養(上午公休)",
      created_at: SEEDED_AT,
    },
    {
      id: "77777777-7777-4777-8777-000000000002",
      date: leaveDate,
      resource_id: RES.ahua,
      type: "closed",
      start_time: null,
      end_time: null,
      reason: "請假",
      created_at: SEEDED_AT,
    },
  ];
}

// --- Seeded PRNG(xmur3 → mulberry32)-------------------------------------
// 決定性:同一 key 恆得同一數列。key 內含 SEED + 日期 + 資源,確保跨 render/請求穩定。

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由字串 key 建立一個決定性 [0,1) 亂數序列產生器 */
function rngFrom(key: string): () => number {
  return mulberry32(xmur3(`${SEED}:${key}`)());
}

/**
 * 佔用率梯度(依「距今天數」)。回傳該 slot 的 booked_count。
 * - 0–6 天:約 90% 全滿,其餘部分佔用
 * - 7–20 天:約 70% 全滿,其餘部分佔用
 * - 21+ 天:booked_count 在 [0, capacity] 之間隨機
 * partial(部分佔用)= [0, capacity-1](capacity=1 → 0,即有位)。
 */
export function occupancyFor(
  daysFromToday: number,
  capacity: number,
  rng: () => number,
): number {
  const fullProb =
    daysFromToday <= 6 ? 0.9 : daysFromToday <= 20 ? 0.7 : null;
  if (fullProb === null) {
    return Math.floor(rng() * (capacity + 1)); // [0, capacity]
  }
  if (rng() < fullProb) return capacity; // 全滿
  return capacity <= 1 ? 0 : Math.floor(rng() * capacity); // partial [0, capacity-1]
}

/**
 * 產生 today … today+RANGE_DAYS 的 slots。
 * 對每個啟用資源、每一天、該資源當天(套用 override 優先權後的)有效開放時段,
 * 以該資源當天挑到的課程 duration 鋪滿;每格再依佔用率梯度指定 booked_count。
 */
export function generateSlots(today: string): Slot[] {
  const overrides = buildDateOverrides(today);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const activeResources = resources.filter((r) => r.is_active);
  const out: Slot[] = [];
  let seq = 0;

  for (let d = 0; d <= RANGE_DAYS; d++) {
    const date = addDays(today, d);
    activeResources.forEach((res, resIdx) => {
      // override 優先權(closed / special_hours)已在此解出 → 直接鋪這些窗
      const { windows } = resolveResourceDay(
        res.id,
        date,
        availabilityRules,
        overrides,
      );
      if (windows.length === 0) return; // 當天無排班或整日休 → 不產生 slot

      // 當天為此資源挑一門課(決定性)
      const candidates = resourceCourses[res.id] ?? [];
      if (candidates.length === 0) return;
      const pick = Math.floor(
        rngFrom(`${date}:${resIdx}:course`)() * candidates.length,
      );
      const course = courseById.get(candidates[pick]);
      if (!course) return;
      const dur = course.duration_min;

      for (const w of windows) {
        const n = Math.floor((w.endMin - w.startMin) / dur);
        for (let i = 0; i < n; i++) {
          const startMin = w.startMin + i * dur;
          const endMin = startMin + dur;
          const rng = rngFrom(`${date}:${resIdx}:${startMin}`);
          const booked = occupancyFor(d, course.capacity, rng);
          seq += 1;
          out.push({
            id: `44444444-4444-4444-8444-${String(seq).padStart(12, "0")}`,
            course_id: course.id,
            resource_id: res.id,
            starts_at: `${date}T${formatMinutes(startMin)}:00+08:00`,
            ends_at: `${date}T${formatMinutes(endMin)}:00+08:00`,
            capacity: course.capacity,
            booked_count: booked,
            created_at: SEEDED_AT,
            updated_at: SEEDED_AT,
          });
        }
      }
    });
  }

  return out;
}
