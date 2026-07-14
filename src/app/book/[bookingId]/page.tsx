/**
 * /book/[bookingId] — 預約狀態 durable 頁(P5)
 *
 * 以 booking_id 回查最新狀態。已登入且為本人 → 直接顯示;
 * 否則引導至我的預約以手機號驗證查詢。
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { shopConfig } from "@/config/shop.config";
import { isValidBookingId } from "@/lib/booking/booking-id";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getClientSession } from "@/lib/auth/client";
import { getClientDataSource } from "@/lib/data/client";
import { BookingDetailCard } from "@/components/BookingDetailCard";

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

  const session = await getClientSession();
  if (session) {
    const ds = await getClientDataSource();
    const bookings = await ds.getBookingsForClient(session.clientId);
    const mine = bookings.find((b) => b.bookingId === code);
    if (mine) {
      return (
        <div className="flex flex-1 flex-col">
          <SiteHeader active="/book" />
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
            <h1 className="font-serif text-2xl font-medium">預約狀態</h1>
            <div className="mt-6">
              <BookingDetailCard booking={mine} />
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/my-bookings"
                className="rounded-full bg-primary px-6 py-2.5 text-center text-sm font-medium text-surface hover:opacity-90"
              >
                我的預約
              </Link>
              <Link
                href="/book"
                className="rounded-full border border-border bg-surface px-6 py-2.5 text-center text-sm text-text hover:border-primary"
              >
                再預約一筆
              </Link>
            </div>
          </main>
          <SiteFooter />
        </div>
      );
    }
  }

  redirect(`/my-bookings?code=${encodeURIComponent(code)}`);
}
