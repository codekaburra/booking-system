"use client";

import { useState } from "react";
import Link from "next/link";
import type { BookingDetailView } from "@/lib/client/booking-view";
import { BookingDetailCard } from "@/components/BookingDetailCard";
import { formatTwMobile } from "@/lib/booking/phone";
import { lookupBookingAction } from "../login/actions";

interface Props {
  loggedIn: boolean;
  userName?: string;
  bookings: BookingDetailView[];
  initialBookingId?: string;
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

export function MyBookingsView({
  loggedIn,
  userName,
  bookings,
  initialBookingId = "",
}: Props) {
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<BookingDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const upcoming = bookings.filter((b) => {
    if (b.status === "pending") return true;
    if (b.confirmedTime && b.status === "approved") return true;
    return false;
  });
  const past = bookings.filter((b) => !upcoming.includes(b));

  async function doLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLookup(null);
    const fd = new FormData();
    fd.set("bookingId", bookingId);
    fd.set("phone", phone);
    const res = await lookupBookingAction(fd);
    setLoading(false);
    if (!res.ok) setError(res.message ?? "查詢失敗");
    else setLookup(res.booking);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-2xl font-medium sm:text-3xl">我的預約</h1>
        {loggedIn && userName && (
          <p className="mt-1 text-sm text-muted">您好,{userName}</p>
        )}
      </div>

      {loggedIn ? (
        <>
          <section>
            <h2 className="text-sm font-medium text-muted">即將到來</h2>
            <div className="mt-3 flex flex-col gap-3">
              {upcoming.length === 0 ? (
                <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
                  目前沒有進行中的預約。
                </p>
              ) : (
                upcoming.map((b) => <BookingDetailCard key={b.bookingId} booking={b} />)
              )}
            </div>
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted">過去紀錄</h2>
              <div className="mt-3 flex flex-col gap-3">
                {past.map((b) => (
                  <BookingDetailCard key={b.bookingId} booking={b} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">以查詢碼查詢</h2>
          <p className="mt-1 text-xs text-muted">
            未登入時,請輸入預約查詢碼與當初填寫的手機號。
          </p>
          <form onSubmit={doLookup} className="mt-4 flex flex-col gap-3">
            {error && (
              <p role="alert" className="text-sm text-status-full-strong">
                {error}
              </p>
            )}
            <label className="flex flex-col gap-1 text-sm">
              查詢碼
              <input
                className={inputClass}
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value.toUpperCase())}
                placeholder="BK-YYYYMMDD-XXXX"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              手機號
              <input
                type="tel"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(formatTwMobile(e.target.value))}
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "查詢中…" : "查詢"}
            </button>
          </form>
          {lookup && (
            <div className="mt-4">
              <BookingDetailCard booking={lookup} />
            </div>
          )}
          <p className="mt-4 text-center text-sm text-muted">
            <Link href="/login" className="text-primary hover:underline">
              登入會員
            </Link>
            {" "}可一次查看所有預約
          </p>
        </section>
      )}
    </div>
  );
}
