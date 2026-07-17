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
  branches,
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

/** branchId 省略 = 不過濾(全事業);與 supabase-source 的行為一致 */
const inBranch = (rowBranchId: string, branchId?: string) =>
  !branchId || rowBranchId === branchId;

export const demoDataSource: BookingDataSource = {
  async getBranches() {
    return branches
      .filter((b) => b.is_active)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  },
  async getBranchBySlug(slug) {
    return branches.find((b) => b.slug === slug && b.is_active) ?? null;
  },
  async getResources(branchId) {
    return resources.filter((r) => r.is_active && inBranch(r.branch_id, branchId));
  },
  async getCourses() {
    return courses.filter((c) => c.is_active);
  },
  async getCourseById(courseId) {
    return courses.find((c) => c.id === courseId && c.is_active) ?? null;
  },
  async getBookableSlots(courseId, now = new Date(), branchId) {
    const nowMs = now.getTime();
    return demoSlots
      .filter(
        (s) =>
          s.course_id === courseId &&
          inBranch(s.branch_id, branchId) &&
          new Date(s.starts_at).getTime() > nowMs &&
          s.booked_count < s.capacity,
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
  },
  async getCourseSlots(courseId, now = new Date(), branchId) {
    const nowMs = now.getTime();
    return demoSlots
      .filter(
        (s) =>
          s.course_id === courseId &&
          inBranch(s.branch_id, branchId) &&
          new Date(s.starts_at).getTime() > nowMs,
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
  },
  async getWeekSlots(weekStart, branchId) {
    const from = taipeiInstant(weekStart).getTime();
    const to = taipeiInstant(addDays(weekStart, 7)).getTime();
    return demoSlots
      .filter((s) => {
        if (!inBranch(s.branch_id, branchId)) return false;
        const t = new Date(s.starts_at).getTime();
        return t >= from && t < to;
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
  },
  async getDateOverrides(startDate, endDate, branchId) {
    return dateOverrides.filter(
      (o) =>
        o.date >= startDate &&
        o.date <= endDate &&
        inBranch(o.branch_id, branchId),
    );
  },
  async getAvailabilityRules(branchId) {
    if (!branchId) return [...availabilityRules];
    // 本表無 branch_id → 以「該分店的資源」反查(同 supabase-source)
    const ids = new Set(
      resources.filter((r) => r.branch_id === branchId).map((r) => r.id),
    );
    return availabilityRules.filter((r) => ids.has(r.resource_id));
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

    // 分店一致性(與 0005 的 create_booking_request 同一條規則):
    // 一筆預約只發生在一間分店 → 志願跨分店直接擋。
    const pickedSlots = input.slotIds
      .map((id) => demoSlots.find((s) => s.id === id))
      .filter((s) => s !== undefined);
    const branchIds = new Set(pickedSlots.map((s) => s.branch_id));
    if (branchIds.size > 1) throw new Error("mixed_branch");
    const branchId = pickedSlots[0]?.branch_id;
    if (!branchId) throw new Error("slot_unavailable");

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
      branch_id: branchId,
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
