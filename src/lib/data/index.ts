/**
 * 資料層查詢介面(P2)— 雙後端:
 *
 * - 有 Supabase env(NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   → 走 supabase-source(server 端 service role;P1 的 RLS 為 deny-all)。
 * - env 缺失 → fallback 到 demo 資料模組(seed.sql 的 TS 鏡射),
 *   讓 template 尚未接 Supabase 也能 preview。
 *
 * 只能在 server 端使用(Server Component / Route Handler)。
 */

import type {
  AvailabilityRule,
  Course,
  DateOverride,
  Resource,
  Slot,
} from "@/types/db";
import { demoDataSource } from "./demo";

export interface BookingDataSource {
  /** 啟用中的資源(教練/房間…),依名稱排序 */
  getResources(): Promise<Resource[]>;
  /** 啟用中的課程 */
  getCourses(): Promise<Course[]>;
  /**
   * weekStart = 台北週一 "YYYY-MM-DD"。
   * 回傳台北時間 [週一 00:00, 下週一 00:00) 範圍內的 slots,依 starts_at 排序。
   */
  getWeekSlots(weekStart: string): Promise<Slot[]>;
  /** [startDate, endDate](台北日期,含兩端)範圍內的 date_overrides */
  getDateOverrides(startDate: string, endDate: string): Promise<DateOverride[]>;
  /** 全部 availability_rules(推導時間軸與休息時段用) */
  getAvailabilityRules(): Promise<AvailabilityRule[]>;
}

/** 是否已設定 Supabase 連線(未設定時走 demo 資料) */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function getDataSource(): Promise<BookingDataSource> {
  if (hasSupabaseEnv()) {
    // 動態 import:demo 模式下完全不觸碰 supabase client
    const { supabaseDataSource } = await import("./supabase-source");
    return supabaseDataSource;
  }
  return demoDataSource;
}
