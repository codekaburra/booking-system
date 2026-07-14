import type { BookingDetailView } from "@/lib/client/booking-view";
import { StatusBadge } from "@/components/StatusBadge";

export function BookingDetailCard({ booking }: { booking: BookingDetailView }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            <span className="font-mono text-sm">{booking.bookingId}</span>
          </div>
          <p className="mt-2 text-sm font-medium">{booking.courseName}</p>
          {booking.confirmedTime && (
            <p className="mt-1 text-sm text-text">
              確定時段:{booking.confirmedTime}
              {booking.confirmedResource ? ` · ${booking.confirmedResource}` : ""}
            </p>
          )}
        </div>
      </div>

      {booking.preferences.length > 0 && booking.status === "pending" && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">志願時段</p>
          <ul className="mt-2 flex flex-col gap-2">
            {booking.preferences.map((p) => (
              <li
                key={p.order}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                  {p.order}
                </span>
                <span>
                  {p.dayLabel} {p.timeLabel} · {p.resourceName}
                </span>
                <span className="text-xs text-muted">
                  餘 {p.remaining}/{p.capacity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {booking.note && (
        <p className="mt-3 text-xs text-muted">備註:{booking.note}</p>
      )}
    </article>
  );
}
