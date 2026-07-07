/**
 * Demo 資料模組 — `supabase/seed.sql` 的 TS 鏡射。
 *
 * ⚠️ 與 seed.sql 同步維護:seed.sql 改了這裡要跟著改(反之亦然)。
 * 用途:未設定 Supabase env 時的 fallback(template preview / 本地開發)。
 *
 * 內容:3 位教練、3 個課程、每週開放時間、date_overrides 示範
 * (7/14 全店 special_hours、7/15 阿華 closed)、兩週 demo slots。
 * 檔尾另有【DEMO_ONLY】段:僅存在於 demo 的補充資料(不在 seed.sql 內)。
 */

import type {
  AvailabilityRule,
  Course,
  DateOverride,
  Resource,
  Slot,
} from "@/types/db";
import { addDays, taipeiInstant } from "@/lib/tz";
import type { BookingDataSource } from "./index";

/** 種子資料的建立時間(與真實 DB 的 created_at 無需一致,僅補齊型別) */
const SEEDED_AT = "2026-07-06T00:00:00+08:00";

const RES = {
  xiaoming: "11111111-1111-4111-8111-000000000001",
  ahua: "11111111-1111-4111-8111-000000000002",
  peipei: "11111111-1111-4111-8111-000000000003",
} as const;

const COURSE = {
  private90: "22222222-2222-4222-8222-000000000001",
  group120: "22222222-2222-4222-8222-000000000002",
  kids60: "22222222-2222-4222-8222-000000000003",
} as const;

const resources: Resource[] = [
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

const courses: Course[] = [
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

const availabilityRules: AvailabilityRule[] = [
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

const dateOverrides: DateOverride[] = [
  // 全店 7/14(二)上午設備保養,只開下午
  {
    id: "77777777-7777-4777-8777-000000000001",
    date: "2026-07-14",
    resource_id: null,
    type: "special_hours",
    start_time: "13:00:00",
    end_time: "18:00:00",
    reason: "設備保養(上午公休)",
    created_at: SEEDED_AT,
  },
  // 阿華 7/15(三)請假整天
  {
    id: "77777777-7777-4777-8777-000000000002",
    date: "2026-07-15",
    resource_id: RES.ahua,
    type: "closed",
    start_time: null,
    end_time: null,
    reason: "請假",
    created_at: SEEDED_AT,
  },
];

function slot(
  seq: number,
  course_id: string,
  resource_id: string,
  date: string,
  start: string,
  end: string,
  capacity: number,
  booked_count: number,
): Slot {
  return {
    id: `44444444-4444-4444-8444-${String(seq).padStart(12, "0")}`,
    course_id,
    resource_id,
    // 與 seed.sql 相同的台北牆上時間,轉為 ISO(+08:00)
    starts_at: `${date}T${start}:00+08:00`,
    ends_at: `${date}T${end}:00+08:00`,
    capacity,
    booked_count,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  };
}

const slots: Slot[] = [
  // 第 1 週
  slot(101, COURSE.private90, RES.xiaoming, "2026-07-07", "10:00", "11:30", 1, 1), // 已被 approved 預約占走(滿)
  slot(102, COURSE.private90, RES.xiaoming, "2026-07-07", "14:00", "15:30", 1, 0),
  slot(103, COURSE.private90, RES.peipei, "2026-07-07", "13:00", "14:30", 1, 0),
  slot(104, COURSE.group120, RES.xiaoming, "2026-07-08", "10:00", "12:00", 8, 0),
  slot(105, COURSE.private90, RES.ahua, "2026-07-08", "10:30", "12:00", 1, 0),
  slot(106, COURSE.group120, RES.ahua, "2026-07-09", "14:00", "16:00", 8, 0),
  slot(107, COURSE.private90, RES.xiaoming, "2026-07-10", "16:00", "17:30", 1, 0),
  slot(108, COURSE.group120, RES.xiaoming, "2026-07-11", "09:00", "11:00", 8, 0),
  slot(109, COURSE.private90, RES.ahua, "2026-07-11", "10:00", "11:30", 1, 0),
  slot(110, COURSE.kids60, RES.peipei, "2026-07-11", "09:30", "10:30", 6, 0),
  slot(111, COURSE.group120, RES.ahua, "2026-07-12", "10:00", "12:00", 8, 0),
  slot(112, COURSE.private90, RES.peipei, "2026-07-12", "09:00", "10:30", 1, 0),
  // 第 2 週(7/14 只開下午;7/15 無阿華)
  slot(113, COURSE.private90, RES.xiaoming, "2026-07-14", "14:00", "15:30", 1, 0),
  slot(114, COURSE.private90, RES.peipei, "2026-07-14", "15:00", "16:30", 1, 0),
  slot(115, COURSE.group120, RES.xiaoming, "2026-07-15", "10:00", "12:00", 8, 0),
  slot(116, COURSE.private90, RES.ahua, "2026-07-16", "11:00", "12:30", 1, 0),
  slot(117, COURSE.private90, RES.xiaoming, "2026-07-17", "10:00", "11:30", 1, 0),
  slot(118, COURSE.group120, RES.xiaoming, "2026-07-18", "09:00", "11:00", 8, 0),
  slot(119, COURSE.group120, RES.ahua, "2026-07-18", "14:00", "16:00", 8, 0),
  slot(120, COURSE.kids60, RES.peipei, "2026-07-19", "10:00", "11:00", 6, 0),

  // ------------------------------------------------------------------
  // 【DEMO_ONLY】以下僅存在於 demo 資料,不在 seed.sql 內。
  // 未來日期的已滿團體課(8/8)— 供 preview 驗證「已滿」樣式
  // (seed 的已滿 slot s101 在 7/7,preview 時多半已成過去式)。
  // 落在佩佩週六 09:00–17:00 開放時段內。
  // ------------------------------------------------------------------
  slot(201, COURSE.group120, RES.peipei, "2026-07-18", "13:00", "15:00", 8, 8),
];

export const demoDataSource: BookingDataSource = {
  async getResources() {
    return resources.filter((r) => r.is_active);
  },
  async getCourses() {
    return courses.filter((c) => c.is_active);
  },
  async getWeekSlots(weekStart) {
    const from = taipeiInstant(weekStart).getTime();
    const to = taipeiInstant(addDays(weekStart, 7)).getTime();
    return slots
      .filter((s) => {
        const t = new Date(s.starts_at).getTime();
        return t >= from && t < to;
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
  },
  async getDateOverrides(startDate, endDate) {
    return dateOverrides.filter(
      (o) => o.date >= startDate && o.date <= endDate,
    );
  },
  async getAvailabilityRules() {
    return [...availabilityRules];
  },
};
