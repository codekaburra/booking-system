import type { BookingStatus } from "@/types/db";
import { statusBadgeMeta } from "@/lib/client/booking-view";

export function StatusBadge({ status }: { status: BookingStatus }) {
  const meta = statusBadgeMeta(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
