/**
 * 收件匣 view model 組裝(P4)。
 */

import { toBookableSlot } from "@/lib/booking/slot-view";
import type {
  BookingRequest,
  Branch,
  Client,
  Course,
  RequestSlot,
  Resource,
  Slot,
} from "@/types/db";
import type { InboxItem, InboxPreference } from "./types";

export function buildInboxItem(
  req: BookingRequest,
  client: Client,
  course: Course,
  prefs: RequestSlot[],
  slots: Slot[],
  resources: Resource[],
  branchesById?: Map<string, Branch>,
): InboxItem {
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const resourceById = new Map(resources.map((r) => [r.id, r]));

  const preferences: InboxPreference[] =
    req.status === "approved" && req.resource_id && req.starts_at && req.ends_at
      ? [
          {
            order: 1,
            slotId: "",
            ...(() => {
              const slot = {
                id: "",
                branch_id: req.branch_id,
                course_id: req.course_id,
                resource_id: req.resource_id!,
                starts_at: req.starts_at!,
                ends_at: req.ends_at!,
                capacity: 1,
                booked_count: 1,
                created_at: "",
                updated_at: "",
              };
              const view = toBookableSlot(
                slot,
                resourceById.get(req.resource_id!),
              );
              return {
                dayLabel: view.dayLabel,
                timeLabel: view.timeLabel,
                resourceName: view.resourceName,
                resourceColor: view.resourceColor,
                capacity: 1,
                booked: 1,
                available: false,
              };
            })(),
          },
        ]
      : prefs
          .sort((a, b) => a.preference_order - b.preference_order)
          .map((p) => {
      const slot = slotById.get(p.slot_id);
      if (!slot) {
        return {
          order: p.preference_order,
          slotId: p.slot_id,
          dayLabel: "—",
          timeLabel: "—",
          resourceName: "—",
          resourceColor: null,
          capacity: 0,
          booked: 0,
          available: false,
        };
      }
      const view = toBookableSlot(slot, resourceById.get(slot.resource_id));
      return {
        order: p.preference_order,
        slotId: p.slot_id,
        dayLabel: view.dayLabel,
        timeLabel: view.timeLabel,
        resourceName: view.resourceName,
        resourceColor: view.resourceColor,
        capacity: slot.capacity,
        booked: slot.booked_count,
        available: slot.booked_count < slot.capacity,
      };
    });

  const channel = req.notify_channel ?? client.preferred_channel;
  const unreachable =
    channel === "email" && !client.email;

  return {
    requestId: req.id,
    bookingId: req.booking_id,
    status: req.status,
    clientName: client.name,
    clientPhone: client.phone,
    clientEmail: client.email,
    unreachable,
    courseName: course.name,
    branchName: branchesById?.get(req.branch_id)?.name ?? "—",
    note: req.note,
    notifyChannel: req.notify_channel,
    createdAt: req.created_at,
    preferences,
  };
}
