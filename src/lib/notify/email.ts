import "server-only";

import { Resend } from "resend";
import { shopConfig } from "@/config/shop.config";

export type NotifyKind = "received" | "confirmed" | "rejected" | "cancelled";

export interface NotifyPayload {
  kind: NotifyKind;
  to: string;
  clientName: string;
  bookingId: string;
  courseName: string;
  /** 確認後的時段描述 */
  timeLabel?: string;
  resourceName?: string;
  reason?: string;
}

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function subject(kind: NotifyKind, bookingId: string): string {
  const shop = shopConfig.name;
  switch (kind) {
    case "received":
      return `【${shop}】預約申請已收到 ${bookingId}`;
    case "confirmed":
      return `【${shop}】預約已確認 ${bookingId}`;
    case "rejected":
      return `【${shop}】預約未成立 ${bookingId}`;
    case "cancelled":
      return `【${shop}】預約已取消 ${bookingId}`;
  }
}

function body(p: NotifyPayload): string {
  const lines = [
    `${p.clientName} 您好,`,
    "",
  ];
  switch (p.kind) {
    case "received":
      lines.push(
        `我們已收到您的「${p.courseName}」預約申請。`,
        `預約編號:${p.bookingId}`,
        "",
        `${shopConfig.resourceLabels[shopConfig.resourceType]}確認後將另行通知。`,
        "請保留此編號以便查詢。",
      );
      break;
    case "confirmed":
      lines.push(
        `您的「${p.courseName}」預約已確認!`,
        `預約編號:${p.bookingId}`,
        p.timeLabel && p.resourceName
          ? `時段:${p.timeLabel}(${p.resourceName})`
          : "",
        "",
        "期待與您見面!",
      );
      break;
    case "rejected":
      lines.push(
        `很抱歉,您的「${p.courseName}」預約申請未能安排。`,
        `預約編號:${p.bookingId}`,
        p.reason ? `說明:${p.reason}` : "",
        "",
        "歡迎重新選擇其他時段預約。",
      );
      break;
    case "cancelled":
      lines.push(
        `您的「${p.courseName}」預約已取消。`,
        `預約編號:${p.bookingId}`,
        p.reason ? `說明:${p.reason}` : "",
      );
      break;
  }
  return lines.filter(Boolean).join("\n");
}

/**
 * 寄送 email;無 RESEND_API_KEY 時靜默跳過(不阻斷交易)。
 * 回傳是否實際寄出。
 */
export async function sendBookingEmail(p: NotifyPayload): Promise<boolean> {
  const resend = resendClient();
  if (!resend) return false;

  const from = process.env.RESEND_FROM ?? `${shopConfig.name} <onboarding@resend.dev>`;

  const { error } = await resend.emails.send({
    from,
    to: p.to,
    subject: subject(p.kind, p.bookingId),
    text: body(p),
  });

  if (error) {
    console.error("[notify] Resend error:", error);
    return false;
  }
  return true;
}

export function canSendEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim()) && Boolean(process.env.RESEND_API_KEY);
}
