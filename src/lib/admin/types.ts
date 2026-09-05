/**
 * 管理後台 view model(P4)。
 */

import type { BookingStatus, NotifyChannel } from "@/types/db";

/** 收件匣單筆申請 */
export interface InboxItem {
  requestId: string;
  bookingId: string;
  status: BookingStatus;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  /** 無法 email 通知時 true(P4 標示) */
  unreachable: boolean;
  courseName: string;
  /** 分店名稱(收件匣跨分店 → 每列標示所屬分店) */
  branchName: string;
  note: string | null;
  notifyChannel: NotifyChannel | null;
  createdAt: string;
  preferences: InboxPreference[];
}

/** 單一志願(含即時餘額) */
export interface InboxPreference {
  order: number;
  slotId: string;
  dayLabel: string;
  timeLabel: string;
  resourceName: string;
  resourceColor: string | null;
  capacity: number;
  booked: number;
  /** booked < capacity */
  available: boolean;
}

/** 手動約課可選 slot */
export interface ManualSlotOption {
  slotId: string;
  courseId: string;
  courseName: string;
  dayLabel: string;
  timeLabel: string;
  resourceName: string;
  remaining: number;
  capacity: number;
}
