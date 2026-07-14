/**
 * Demo 資料模組 — Supabase env 未設定時的 fallback(template preview / 本地開發)。
 *
 * ⚠️ 本檔已**不再是 seed.sql 的逐列鏡射**。resources / courses / availability_rules
 *    仍與 seed 一致,但 date_overrides 與 slots 改由 `demo-generator.ts` 以「今天
 *    (Asia/Taipei)」為基準程式化生成(today … today+45 天),讓月曆檢視有真實密度。
 *
 * P5:預約送出會寫入 demo-store 的 booking_requests,供我的預約 / 後台共用。
 */

import type { CreateBookingResult } from "@/lib/booking/types";
import { generateBookingId } from "@/lib/booking/booking-id";
import { normalizePhone } from "@/lib/booking/phone";
import { defaultNotifyChannel } from "@/config/shop.config";
import { addDays, taipeiInstant, taipeiToday } from "@/lib/tz";
import {
  availabilityRules,
  buildDateOverrides,
  courses,
  resources,
} from "./demo-generator";
import {
  demoClients,
  demoRequestSlots,
  demoRequests,
  demoSlots,
} from "./demo-store";
import type { BookingDataSource } from "./index";

const DEMO_TODAY = taipeiToday();
const dateOverrides = buildDateOverrides(DEMO_TODAY);

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
    return demoSlots
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
    return demoSlots
      .filter(
        (s) =>
          s.course_id === courseId &&
          new Date(s.starts_at).getTime() > nowMs,
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
  },
  async getWeekSlots(weekStart) {
    const from = taipeiInstant(weekStart).getTime();
    const to = taipeiInstant(addDays(weekStart, 7)).getTime();
    return demoSlots
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

  async findClientByPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return demoClients.find((c) => c.phone === normalized) ?? null;
  },

  async createBooking(input): Promise<CreateBookingResult> {
    const normalized = normalizePhone(input.phone);
    if (!normalized) throw new Error("phone_invalid");
    if (!input.name?.trim()) throw new Error("name_required");
    if (!input.slotIds || input.slotIds.length === 0) {
      throw new Error("slots_required");
    }

    let client = demoClients.find((c) => c.phone === normalized);
    if (client) {
      const name = input.name.trim();
      if (name) client.name = name;
      const email = input.email?.trim();
      if (email) client.email = email;
    } else {
      const now = new Date().toISOString();
      client = {
        id: `demo-client-${demoClients.length + 1}`,
        name: input.name.trim(),
        phone: normalized,
        email: input.email?.trim() || null,
        line_user_id: null,
        preferred_channel: defaultNotifyChannel(),
        auth_user_id: null,
        note: null,
        created_at: now,
        updated_at: now,
      };
      demoClients.push(client);
    }

    const bookingId = generateBookingId();
    const reqId = `demo-req-${demoRequests.length + 1}`;
    demoRequests.push({
      id: reqId,
      client_id: client.id,
      booking_id: bookingId,
      status: "pending",
      course_id: input.courseId,
      resource_id: null,
      starts_at: null,
      ends_at: null,
      note: input.note?.trim() || null,
      notify_channel: defaultNotifyChannel(),
      notified_at: new Date().toISOString(),
      gcal_event_id: null,
      company_gcal_event_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    input.slotIds.forEach((slotId, i) => {
      demoRequestSlots.push({
        request_id: reqId,
        slot_id: slotId,
        preference_order: i + 1,
      });
    });

    return { bookingId, demo: true };
  },
};
