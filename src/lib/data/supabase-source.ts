/**
 * Supabase 後端的資料層實作(P2 唯讀查詢)。
 *
 * P1 的 RLS 為 deny-all,故一律在 server 端以 service role 查詢
 * (getSupabaseServerClient 已擋瀏覽器端使用)。
 */

import "server-only";

import type {
  AvailabilityRule,
  Client,
  Course,
  DateOverride,
  Resource,
  Slot,
} from "@/types/db";
import type { CreateBookingResult } from "@/lib/booking/types";
import { getSupabaseServerClient } from "@/lib/supabase";
import { defaultNotifyChannel } from "@/config/shop.config";
import { normalizePhone } from "@/lib/booking/phone";
import { addDays, taipeiInstant } from "@/lib/tz";
import type { BookingDataSource } from "./index";

function unwrap<T>(table: string, data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(`讀取 ${table} 失敗:${error.message}`);
  return data ?? ([] as T);
}

export const supabaseDataSource: BookingDataSource = {
  async getResources() {
    const { data, error } = await getSupabaseServerClient()
      .from("resources")
      .select("*")
      .eq("is_active", true)
      .order("name");
    return unwrap<Resource[]>("resources", data, error);
  },

  async getCourses() {
    const { data, error } = await getSupabaseServerClient()
      .from("courses")
      .select("*")
      .eq("is_active", true)
      .order("name");
    return unwrap<Course[]>("courses", data, error);
  },

  async getCourseById(courseId) {
    const { data, error } = await getSupabaseServerClient()
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(`讀取 courses 失敗:${error.message}`);
    return (data as Course | null) ?? null;
  },

  async getWeekSlots(weekStart) {
    // 台北 [週一 00:00, 下週一 00:00) → UTC instant 範圍
    const from = taipeiInstant(weekStart).toISOString();
    const to = taipeiInstant(addDays(weekStart, 7)).toISOString();
    const { data, error } = await getSupabaseServerClient()
      .from("slots")
      .select("*")
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    return unwrap<Slot[]>("slots", data, error);
  },

  async getBookableSlots(courseId, now = new Date()) {
    // 未來 + 有空位 + 課程相符;空位條件用 DB 端比較欄位(gt column)
    const { data, error } = await getSupabaseServerClient()
      .from("slots")
      .select("*")
      .eq("course_id", courseId)
      .gt("starts_at", now.toISOString())
      .order("starts_at");
    const rows = unwrap<Slot[]>("slots", data, error);
    // booked_count < capacity 無法直接在 PostgREST 用「欄位比欄位」,故在此過濾
    return rows.filter((s) => s.booked_count < s.capacity);
  },

  async getCourseSlots(courseId, now = new Date()) {
    // 未來 + 課程相符;**含已額滿**(供月曆日檢視把額滿時段以 disabled 呈現)。
    const { data, error } = await getSupabaseServerClient()
      .from("slots")
      .select("*")
      .eq("course_id", courseId)
      .gt("starts_at", now.toISOString())
      .order("starts_at");
    return unwrap<Slot[]>("slots", data, error);
  },

  async getDateOverrides(startDate, endDate) {
    const { data, error } = await getSupabaseServerClient()
      .from("date_overrides")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");
    return unwrap<DateOverride[]>("date_overrides", data, error);
  },

  async getAvailabilityRules() {
    const { data, error } = await getSupabaseServerClient()
      .from("availability_rules")
      .select("*")
      .order("weekday");
    return unwrap<AvailabilityRule[]>("availability_rules", data, error);
  },

  async findClientByPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const { data, error } = await getSupabaseServerClient()
      .from("clients")
      .select("*")
      .eq("phone", normalized)
      .maybeSingle();
    if (error) throw new Error(`讀取 clients 失敗:${error.message}`);
    return (data as Client | null) ?? null;
  },

  async createBooking(input): Promise<CreateBookingResult> {
    const normalized = normalizePhone(input.phone);
    if (!normalized) throw new Error("phone_invalid");
    // 交易全部在 DB 函式內(客戶歸戶 + booking_requests + request_slots);
    // 見 supabase/migrations/0002_create_booking_request.sql。
    const { data, error } = await getSupabaseServerClient().rpc(
      "create_booking_request",
      {
        p_course_id: input.courseId,
        p_slot_ids: input.slotIds,
        p_name: input.name.trim(),
        p_phone: normalized,
        p_email: input.email?.trim() || null,
        p_note: input.note?.trim() || null,
        // 預設通知管道取自 shop.config(第一個開啟的 channel),不寫死 "email"。
        // 通知寄送本身是 P6;此處僅決定 clients.preferred_channel / notify_channel 預設值。
        p_channel: defaultNotifyChannel(),
      },
    );
    if (error) throw new Error(`建立預約失敗:${error.message}`);
    return { bookingId: data as string, demo: false };
  },
};
