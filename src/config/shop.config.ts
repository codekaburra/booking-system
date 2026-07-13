/**
 * 每店差異設定(PLAN.md §3)
 *
 * 靜態品牌設定放這裡 + `.env`(Supabase 連線、通知 API key…);
 * 營運資料(課程、教練、開放時間、預約)放各店 Supabase,後台可改。
 *
 * 開新店:改這個檔 + 填 `.env`,不要在其他地方 hardcode 店家資訊。
 */

import type { NotifyChannel, ResourceType } from "@/types/db";

export type BookingMode = "request" | "instant";
export type { NotifyChannel, ResourceType };

export interface ShopConfig {
  /** 店名(頁面標題、通知內文) */
  name: string;
  /** 專案識別 slug(branch / Supabase / Vercel 專案命名) */
  slug: string;
  /** IANA 時區;台灣的店一律 Asia/Taipei */
  timezone: string;
  /** 介面語系 */
  locale: string;
  /**
   * 預約模式(PLAN.md §6)
   * - "request":申請制 — 多志願 → 老闆確認(雪板課等課程店)
   * - "instant":即時制 — 選資源 + 起始時間 + 時長 → 立即確認(自助房間)
   */
  bookingMode: BookingMode;
  /**
   * 主題色覆寫:只覆寫 base 色(--color-primary / --color-secondary)。
   * 狀態語意色(--status-*)全 template 統一,不提供覆寫。
   */
  theme: {
    primary?: string;
    secondary?: string;
  };
  /** 通知管道開關(PLAN.md §8) */
  notifications: Record<NotifyChannel, boolean>;
  /** 本店的主要資源型態(對應 resources.type) */
  resourceType: ResourceType;
  /** 各資源型態在介面上的稱呼(繁中顯示字) */
  resourceLabels: Record<ResourceType, string>;
  /** 取消政策:開課前 N 小時內不可自助取消(P6 使用) */
  cancellationCutoffHours: number;
}

export const shopConfig: ShopConfig = {
  name: "白峰雪板學校",
  slug: "booking-snowboard",
  timezone: "Asia/Taipei",
  locale: "zh-TW",
  bookingMode: "request",
  theme: {
    // 雪板店換冰川藍;Sage green 為 template 預設(globals.css)
    primary: "#6b9bb5",
  },
  notifications: {
    email: true,
    whatsapp: false,
    line: false,
  },
  resourceType: "instructor",
  resourceLabels: {
    instructor: "教練",
    room: "房間",
    equipment: "器材",
  },
  cancellationCutoffHours: 24,
};

/**
 * 本店預設通知管道 = notifications 中第一個開啟的 channel;全關則退回 "email"。
 * 用於:新客戶的 clients.preferred_channel、模式 A 送出的 notify_channel 預設,
 * 避免把 "email" 這個店家設定寫死在資料層(通知本身在 P6)。
 */
export function defaultNotifyChannel(config: ShopConfig = shopConfig): NotifyChannel {
  const order: NotifyChannel[] = ["email", "whatsapp", "line"];
  return order.find((c) => config.notifications[c]) ?? "email";
}

export default shopConfig;
