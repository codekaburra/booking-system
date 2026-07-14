/**
 * 組裝 BookingDetailView(客戶端 / admin 共用邏輯)。
 */

import type {
  BookingRequest,
  Client,
  Course,
  RequestSlot,
  Resource,
  Slot,
} from "@/types/db";
import type { BookingDetailView } from "@/lib/client/booking-view";
import { toBookableSlot } from "@/lib/booking/slot-view";

export function buildBookingDetail(
  req: BookingRequest,
  client: Client,
  course: Course,
  prefs: RequestSlot[],
  slots: Slot[],
  resources: Resource[],
): BookingDetailView {
  const slotMap = new Map(slots.map((s) => [s.id, s]));
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  const preferences = [...prefs]
    .sort((a, b) => a.preference_order - b.preference_order)
    .map((p) => {
      const slot = slotMap.get(p.slot_id);
      if (!slot) {
        return {
          order: p.preference_order,
          dayLabel: "—",
          timeLabel: "—",
          resourceName: "—",
          remaining: 0,
          capacity: 0,
        };
      }
      const view = toBookableSlot(slot, resourceMap.get(slot.resource_id));
      return {
        order: p.preference_order,
        dayLabel: view.dayLabel,
        timeLabel: view.timeLabel,
        resourceName: view.resourceName,
        remaining: slot.capacity - slot.booked_count,
        capacity: slot.capacity,
      };
    });

  let confirmedTime: string | undefined;
  let confirmedResource: string | undefined;
  if (req.starts_at && req.ends_at && req.resource_id) {
    const res = resourceMap.get(req.resource_id);
    const view = toBookableSlot(
      {
        id: "",
        course_id: req.course_id,
        resource_id: req.resource_id,
        starts_at: req.starts_at,
        ends_at: req.ends_at,
        capacity: 1,
        booked_count: 0,
        created_at: "",
        updated_at: "",
      },
      res,
    );
    confirmedTime = `${view.dayLabel} ${view.timeLabel}`;
    confirmedResource = view.resourceName;
  }

  return {
    bookingId: req.booking_id,
    status: req.status,
    courseName: course.name,
    clientName: client.name,
    note: req.note,
    confirmedTime,
    confirmedResource,
    preferences,
    createdAt: req.created_at,
  };
}
