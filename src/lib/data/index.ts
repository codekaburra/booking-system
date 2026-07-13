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

import "server-only";

import type {
  AvailabilityRule,
  Client,
  Course,
  DateOverride,
  Resource,
  Slot,
} from "@/types/db";
import type { CreateBookingInput, CreateBookingResult } from "@/lib/booking/types";
import { demoDataSource } from "./demo";

export interface BookingDataSource {
  /** 啟用中的資源(教練/房間…),依名稱排序 */
  getResources(): Promise<Resource[]>;
  /** 啟用中的課程 */
  getCourses(): Promise<Course[]>;
  /** 單一啟用中課程(表單步驟①/送出驗證用);找不到回 null */
  getCourseById(courseId: string): Promise<Course | null>;
  /**
   * weekStart = 台北週一 "YYYY-MM-DD"。
   * 回傳台北時間 [週一 00:00, 下週一 00:00) 範圍內的 slots,依 starts_at 排序。
   */
  getWeekSlots(weekStart: string): Promise<Slot[]>;
  /**
   * 某課程「可預約」的 slots(模式 A 表單步驟②):
   * course_id 相符、starts_at 在未來(now 之後)、booked_count < capacity,
   * 依 starts_at 排序。now 預設為呼叫時的現在。
   */
  getBookableSlots(courseId: string, now?: Date): Promise<Slot[]>;
  /**
   * 某課程「未來的全部 slots」(模式 A 月曆日檢視用):course_id 相符、
   * starts_at 在未來(now 之後),**含已額滿**(booked_count >= capacity),
   * 依 starts_at 排序。與 getBookableSlots 的差異:不濾掉已滿 —— 讓 UI 能把
   * 「未來但已額滿」的時段以 disabled「已額滿」列出,而非直接消失。
   * (可選 / 送出仍只認 getBookableSlots 的有空位者;server 端再驗一次。)
   */
  getCourseSlots(courseId: string, now?: Date): Promise<Slot[]>;
  /** [startDate, endDate](台北日期,含兩端)範圍內的 date_overrides */
  getDateOverrides(startDate: string, endDate: string): Promise<DateOverride[]>;
  /** 全部 availability_rules(推導時間軸與休息時段用) */
  getAvailabilityRules(): Promise<AvailabilityRule[]>;

  // --- 寫入(P3 模式 A 送出)---
  /** 依手機號查客戶(歸戶);找不到回 null */
  findClientByPhone(phone: string): Promise<Client | null>;
  /**
   * 交易式建立預約(客戶歸戶 + booking_requests + request_slots 一次完成)。
   * server 端已先做形狀與可用性驗證;此處為最終寫入(真實後端另在 DB 函式再驗一次)。
   */
  createBooking(input: CreateBookingInput): Promise<CreateBookingResult>;
}

/**
 * 是否已設定 Supabase 連線。
 * - 兩者皆缺 → 走 demo 資料(false)。
 * - 兩者皆有 → 走真實後端(true)。
 * - 只設其一(常見:prod 少貼 key 或打錯)→ 直接 throw,避免整站悄悄退回 demo
 *   雪板 seed 資料的 production footgun。
 */
export function hasSupabaseEnv(): boolean {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (hasUrl !== hasKey) {
    throw new Error(
      "Supabase partially configured: set both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or neither for demo mode",
    );
  }
  return hasUrl && hasKey;
}

export async function getDataSource(): Promise<BookingDataSource> {
  if (hasSupabaseEnv()) {
    // 動態 import:demo 模式下完全不觸碰 supabase client
    const { supabaseDataSource } = await import("./supabase-source");
    return supabaseDataSource;
  }
  return demoDataSource;
}
