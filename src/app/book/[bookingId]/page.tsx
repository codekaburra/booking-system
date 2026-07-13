/**
 * /book/[bookingId] — 預約狀態 durable 頁(P3)
 *
 * 送出成功後 <BookFlow> 會把網址改成本路徑(方便截圖/分享),完整志願摘要在
 * 送出當下已由 client 直接顯示(demo 不落地、重新整理不再回查 —— 這是刻意的)。
 *
 * 本頁面是「直接開啟 / 重新整理 / 分享連結」時的落地頁。此處**無法**得知該筆申請的
 * 真實狀態(P3 尚無回查方法),故不可顯示「待確認」等權威狀態 —— 只呈現中性的
 * 「查詢碼」與「這是剛送出的申請」語意,避免對未落地/未知狀態做假斷言。
 *
 * TODO(P5 我的預約):真實後端在此以 booking_id 回查 booking_requests + request_slots
 *   + slots + resources,顯示完整志願與最新狀態(需新增 getBookingByCode 資料層方法)。
 *   屆時才可顯示真實狀態 badge(待確認/已確認/…)。
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { shopConfig } from "@/config/shop.config";
import { isValidBookingId } from "@/lib/booking/booking-id";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: `${shopConfig.name}|預約狀態`,
};

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const code = decodeURIComponent(bookingId);
  if (!isValidBookingId(code)) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader active="/book" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-bg px-3 py-1 text-xs font-medium text-muted">
            查詢碼
          </span>
          <p className="select-all font-mono text-2xl font-semibold tracking-widest sm:text-3xl">
            {code}
          </p>
        </div>

        <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-7 text-text">
          這是您剛送出的預約申請查詢碼。請保留此碼以便日後查詢;
          {shopConfig.resourceLabels[shopConfig.resourceType]}確認後將另行通知。
          {/* TODO(P5):以查詢碼回查申請的最新狀態與完整志願,屆時才顯示真實狀態。 */}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/book"
            className="rounded-full bg-primary px-6 py-2.5 text-center text-sm font-medium text-surface transition hover:opacity-90"
          >
            再預約一筆
          </Link>
          <Link
            href="/timetable"
            className="rounded-full border border-border bg-surface px-6 py-2.5 text-center text-sm text-text hover:border-primary hover:text-primary"
          >
            查看週課表
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
