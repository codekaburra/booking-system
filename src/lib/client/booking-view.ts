/**
 * 客戶端預約檢視模型(P5) — 我的預約 / 狀態頁共用。
 */

import type { BookingStatus } from "@/types/db";

export interface BookingPreferenceView {
  order: number;
  dayLabel: string;
  timeLabel: string;
  resourceName: string;
  remaining: number;
  capacity: number;
}

export interface BookingDetailView {
  bookingId: string;
  status: BookingStatus;
  courseName: string;
  clientName: string;
  note: string | null;
  /** 已確認/已完成時的確定時段 */
  confirmedTime?: string;
  confirmedResource?: string;
  preferences: BookingPreferenceView[];
  createdAt: string;
}

const STATUS_META: Record<
  BookingStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "待確認",
    className: "bg-status-pending/20 text-status-pending-strong",
  },
  approved: {
    label: "已確認",
    className: "bg-status-available/20 text-status-available-strong",
  },
  rejected: {
    label: "已拒絕",
    className: "bg-status-cancelled/20 text-status-cancelled",
  },
  cancelled: {
    label: "已取消",
    className: "bg-status-cancelled/20 text-status-cancelled line-through",
  },
  completed: {
    label: "已上課",
    className: "bg-border/60 text-muted",
  },
};

export function statusBadgeMeta(status: BookingStatus) {
  return STATUS_META[status];
}
