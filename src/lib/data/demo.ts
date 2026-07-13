/**
 * Demo 資料模組 — Supabase env 未設定時的 fallback(template preview / 本地開發)。
 *
 * ⚠️ 本檔已**不再是 seed.sql 的逐列鏡射**。resources / courses / availability_rules
 *    仍與 seed 一致,但 date_overrides 與 slots 改由 `demo-generator.ts` 以「今天
 *    (Asia/Taipei)」為基準程式化生成(today … today+45 天),讓月曆檢視有真實密度:
 *      - 近 0–6 天約 90% 全滿、7–20 天約 70%、21+ 天隨機 → 近期幾乎無位、之後漸鬆。
 *      - override 示範固定相對今天:today+3 全店只開下午、today+5 阿華請假整天。
 *    `supabase/seed.sql` 維持最小、可對映真實 DB 的正式種子(兩者刻意分家)。
 *
 * clients 陣列仍為 seed.sql 的鏡射(手機歸戶示範用),createBooking 只在記憶體 push。
 */

import type { Client } from "@/types/db";
import type { CreateBookingResult } from "@/lib/booking/types";
import { generateBookingId } from "@/lib/booking/booking-id";
import { normalizePhone } from "@/lib/booking/phone";
import { defaultNotifyChannel } from "@/config/shop.config";
import { addDays, taipeiInstant, taipeiToday } from "@/lib/tz";
import {
  availabilityRules,
  buildDateOverrides,
  courses,
  generateSlots,
  resources,
} from "./demo-generator";
import type { BookingDataSource } from "./index";

/** 種子資料的建立時間(僅補齊型別) */
const SEEDED_AT = "2026-07-06T00:00:00+08:00";

// 今日相對資料:module 載入時以台北今天生成一次(同一 process 內穩定、可重現)。
const DEMO_TODAY = taipeiToday();
const dateOverrides = buildDateOverrides(DEMO_TODAY);
const slots = generateSlots(DEMO_TODAY);

/** demo 客戶(seed.sql 的鏡射;findClientByPhone 歸戶示範用)。
 *  可變陣列:createBooking 會 push 新客戶。變動只存在於當前 server process
 *  記憶體、不落地 DB(process 重啟即 reset — demo 用途,可接受)。 */
const clients: Client[] = [
  {
    id: "33333333-3333-4333-8333-000000000001",
    name: "王小美",
    phone: "0912345678",
    email: "xiaomei@example.com",
    line_user_id: null,
    preferred_channel: "email",
    auth_user_id: null,
    note: null,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: "33333333-3333-4333-8333-000000000002",
    name: "陳大明",
    phone: "0987654321",
    email: "daming@example.com",
    line_user_id: null,
    preferred_channel: "email",
    auth_user_id: null,
    note: "初學者",
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: "33333333-3333-4333-8333-000000000003",
    name: "林雅婷",
    phone: "0933222111",
    email: null,
    line_user_id: null,
    preferred_channel: "email",
    auth_user_id: null,
    note: "電話約課常客",
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
];

export const demoDataSource: BookingDataSource = {
  async getResources() {
    return resources.filter((r) => r.is_active);
  },
  async getCourses() {
    return courses.filter((c) => c.is_active);
  },
  async getCourseById(courseId) {
    return courses.find((c) => c.id === courseId && c.is_active) ?? null;
  },
  async getBookableSlots(courseId, now = new Date()) {
    const nowMs = now.getTime();
    return slots
      .filter(
        (s) =>
          s.course_id === courseId &&
          new Date(s.starts_at).getTime() > nowMs &&
          s.booked_count < s.capacity,
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
  },
  async getCourseSlots(courseId, now = new Date()) {
    const nowMs = now.getTime();
    return slots
      .filter(
        (s) =>
          s.course_id === courseId &&
          new Date(s.starts_at).getTime() > nowMs, // 含已額滿(不濾 booked<capacity)
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
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

  // --- 寫入(P3 模式 A 送出;demo 版)---------------------------------------
  // 真實後端的交易 + slot 重驗在 0002 的 DB 函式;demo 版只做「手機歸戶」
  // 與產碼,足以讓 preview 走完整流程。不建立 booking_requests / request_slots
  // (demo 不落地;狀態頁改用送出後回傳的 result 顯示,不回查)。

  async findClientByPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return clients.find((c) => c.phone === normalized) ?? null;
  },

  async createBooking(input): Promise<CreateBookingResult> {
    const normalized = normalizePhone(input.phone);
    if (!normalized) throw new Error("phone_invalid");
    if (!input.name?.trim()) throw new Error("name_required");
    if (!input.slotIds || input.slotIds.length === 0) {
      throw new Error("slots_required");
    }
    // 歸戶:同手機重用既有客戶,否則新增一筆(僅記憶體、不落地)。
    const existing = clients.find((c) => c.phone === normalized);
    if (existing) {
      const name = input.name.trim();
      if (name) existing.name = name;
      const email = input.email?.trim();
      if (email) existing.email = email;
    } else {
      const now = new Date().toISOString();
      clients.push({
        id: `demo-client-${clients.length + 1}`,
        name: input.name.trim(),
        phone: normalized,
        email: input.email?.trim() || null,
        line_user_id: null,
        // 新客戶預設通知管道取自 shop.config(不寫死 "email")。
        preferred_channel: defaultNotifyChannel(),
        auth_user_id: null,
        note: null,
        created_at: now,
        updated_at: now,
      });
    }
    return { bookingId: generateBookingId(), demo: true };
  },
};
