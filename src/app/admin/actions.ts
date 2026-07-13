"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminDataSource } from "@/lib/data/admin";
import { canSendEmail, sendBookingEmail } from "@/lib/notify/email";

function friendlyError(msg: string): string {
  if (msg.includes("slot_full")) return "此時段已額滿,請選擇其他志願。";
  if (msg.includes("resource_overlap")) return "教練此時段已有其他預約,無法確認。";
  if (msg.includes("request_not_pending")) return "此申請狀態已變更,請重新整理。";
  if (msg.includes("unauthorized")) return "請先登入管理後台。";
  return "操作失敗,請稍後再試。";
}

async function notifyAfter(
  bookingId: string,
  kind: "confirmed" | "rejected" | "cancelled",
  reason?: string,
) {
  const ds = await getAdminDataSource();
  const info = await ds.getBookingForNotify(bookingId);
  if (!info || !canSendEmail(info.clientEmail)) return;
  await sendBookingEmail({
    kind,
    to: info.clientEmail!,
    clientName: info.clientName,
    bookingId: info.bookingId,
    courseName: info.courseName,
    timeLabel: info.timeLabel,
    resourceName: info.resourceName,
    reason,
  });
}

export async function approveRequestAction(requestId: string, slotId: string) {
  try {
    await requireAdmin();
    const ds = await getAdminDataSource();
    const bookingId = await ds.approve(requestId, slotId);
    await notifyAfter(bookingId, "confirmed");
    revalidatePath("/admin/inbox");
    return { ok: true as const, bookingId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message: friendlyError(msg) };
  }
}

export async function rejectRequestAction(requestId: string, reason?: string) {
  try {
    await requireAdmin();
    const ds = await getAdminDataSource();
    const bookingId = await ds.reject(requestId, reason);
    await notifyAfter(bookingId, "rejected", reason);
    revalidatePath("/admin/inbox");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message: friendlyError(msg) };
  }
}

export async function cancelRequestAction(requestId: string, reason?: string) {
  try {
    await requireAdmin();
    const ds = await getAdminDataSource();
    const bookingId = await ds.cancel(requestId, reason);
    await notifyAfter(bookingId, "cancelled", reason);
    revalidatePath("/admin/inbox");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message: friendlyError(msg) };
  }
}

export async function manualBookingAction(
  slotId: string,
  name: string,
  phone: string,
  email?: string,
  note?: string,
) {
  try {
    await requireAdmin();
    const ds = await getAdminDataSource();
    const bookingId = await ds.manualBooking(slotId, name, phone, email, note);
    await notifyAfter(bookingId, "confirmed");
    revalidatePath("/admin/inbox");
    revalidatePath("/admin/manual");
    return { ok: true as const, bookingId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message: friendlyError(msg) };
  }
}
