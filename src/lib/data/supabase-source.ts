/**
 * Supabase 後端的資料層實作(P2 唯讀查詢)。
 *
 * P1 的 RLS 為 deny-all,故一律在 server 端以 service role 查詢
 * (getSupabaseServerClient 已擋瀏覽器端使用)。
 */

import "server-only";

import type {
  AvailabilityRule,
  Course,
  DateOverride,
  Resource,
  Slot,
} from "@/types/db";
import { getSupabaseServerClient } from "@/lib/supabase";
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
};
