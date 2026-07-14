/**
 * 管理後台資料層(P4) — 真實 Supabase + demo 雙後端。
 */

import "server-only";

import type {
  BookingRequest,
  Client,
  Course,
  RequestSlot,
  Slot,
} from "@/types/db";
import { buildInboxItem } from "@/lib/admin/inbox-view";
import type { InboxItem, ManualSlotOption } from "@/lib/admin/types";
import { toBookableSlot } from "@/lib/booking/slot-view";
import { generateBookingId } from "@/lib/booking/booking-id";
import { normalizePhone } from "@/lib/booking/phone";
import { defaultNotifyChannel } from "@/config/shop.config";
import { getDataSource, hasSupabaseEnv } from "@/lib/data";
import { getSupabaseServerClient } from "@/lib/supabase";
import {
  demoClients,
  demoRequestSlots,
  demoRequests,
  demoSlots,
} from "@/lib/data/demo-store";
import {
  availabilityRules,
  buildDateOverrides,
  courses,
  resources,
} from "@/lib/data/demo-generator";
import { taipeiToday } from "@/lib/tz";

// --- Demo 記憶體狀態(程序內;重啟 reset)-----------------------------------

const DEMO_TODAY = taipeiToday();
void availabilityRules;
void buildDateOverrides(DEMO_TODAY);

// --- Interface ---------------------------------------------------------------

export interface AdminDataSource {
  getInbox(status?: "pending" | "approved" | "all"): Promise<InboxItem[]>;
  getManualSlotOptions(): Promise<ManualSlotOption[]>;
  approve(requestId: string, slotId: string): Promise<string>;
  reject(requestId: string, reason?: string): Promise<string>;
  cancel(requestId: string, reason?: string): Promise<string>;
  manualBooking(
    slotId: string,
    name: string,
    phone: string,
    email?: string,
    note?: string,
  ): Promise<string>;
  getBookingForNotify(bookingId: string): Promise<{
    clientName: string;
    clientEmail: string | null;
    courseName: string;
    bookingId: string;
    timeLabel?: string;
    resourceName?: string;
  } | null>;
}

// --- Supabase ----------------------------------------------------------------

const supabaseAdmin: AdminDataSource = {
  async getInbox(status = "pending") {
    let q = getSupabaseServerClient()
      .from("booking_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (status === "pending") q = q.eq("status", "pending");
    else if (status === "approved") q = q.eq("status", "approved");

    const { data: reqs, error } = await q;
    if (error) throw new Error(error.message);
    if (!reqs?.length) return [];

    const clientIds = [...new Set(reqs.map((r) => r.client_id))];
    const courseIds = [...new Set(reqs.map((r) => r.course_id))];
    const reqIds = reqs.map((r) => r.id);

    const [clients, courseRows, prefRows, resources] = await Promise.all([
      getSupabaseServerClient().from("clients").select("*").in("id", clientIds),
      getSupabaseServerClient().from("courses").select("*").in("id", courseIds),
      getSupabaseServerClient().from("request_slots").select("*").in("request_id", reqIds),
      getDataSource().then((ds) => ds.getResources()),
    ]);

    const slotIds = [...new Set((prefRows.data ?? []).map((p) => p.slot_id))];
    const { data: slotRows } = slotIds.length
      ? await getSupabaseServerClient().from("slots").select("*").in("id", slotIds)
      : { data: [] as Slot[] };

    const clientMap = new Map((clients.data ?? []).map((c) => [c.id, c as Client]));
    const courseMap = new Map((courseRows.data ?? []).map((c) => [c.id, c as Course]));
    const prefsByReq = new Map<string, RequestSlot[]>();
    for (const p of prefRows.data ?? []) {
      const list = prefsByReq.get(p.request_id) ?? [];
      list.push(p as RequestSlot);
      prefsByReq.set(p.request_id, list);
    }

    return (reqs as BookingRequest[]).map((req) =>
      buildInboxItem(
        req,
        clientMap.get(req.client_id)!,
        courseMap.get(req.course_id)!,
        prefsByReq.get(req.id) ?? [],
        (slotRows ?? []) as Slot[],
        resources,
      ),
    );
  },

  async getManualSlotOptions() {
    const ds = await getDataSource();
    const now = new Date();
    const [courseRows, resources] = await Promise.all([
      ds.getCourses(),
      ds.getResources(),
    ]);
    const resourceMap = new Map(resources.map((r) => [r.id, r]));
    const courseMap = new Map(courseRows.map((c) => [c.id, c]));

    const lists = await Promise.all(
      courseRows.map((c) => ds.getBookableSlots(c.id, now)),
    );

    const out: ManualSlotOption[] = [];
    courseRows.forEach((c, i) => {
      for (const slot of lists[i]) {
        const view = toBookableSlot(slot, resourceMap.get(slot.resource_id));
        out.push({
          slotId: slot.id,
          courseId: c.id,
          courseName: courseMap.get(c.id)!.name,
          dayLabel: view.dayLabel,
          timeLabel: view.timeLabel,
          resourceName: view.resourceName,
          remaining: slot.capacity - slot.booked_count,
          capacity: slot.capacity,
        });
      }
    });
    return out.sort(
      (a, b) =>
        a.dayLabel.localeCompare(b.dayLabel) || a.timeLabel.localeCompare(b.timeLabel),
    );
  },

  async approve(requestId, slotId) {
    const { data, error } = await getSupabaseServerClient().rpc(
      "approve_booking_request",
      { p_request_id: requestId, p_slot_id: slotId },
    );
    if (error) throw new Error(error.message);
    return data as string;
  },

  async reject(requestId, reason) {
    const { data, error } = await getSupabaseServerClient().rpc(
      "reject_booking_request",
      { p_request_id: requestId, p_reason: reason ?? null },
    );
    if (error) throw new Error(error.message);
    return data as string;
  },

  async cancel(requestId, reason) {
    const { data, error } = await getSupabaseServerClient().rpc(
      "cancel_booking_request",
      { p_request_id: requestId, p_reason: reason ?? null },
    );
    if (error) throw new Error(error.message);
    return data as string;
  },

  async manualBooking(slotId, name, phone, email, note) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error("phone_invalid");
    const { data, error } = await getSupabaseServerClient().rpc(
      "create_manual_booking",
      {
        p_slot_id: slotId,
        p_name: name.trim(),
        p_phone: normalized,
        p_email: email?.trim() || null,
        p_note: note?.trim() || null,
        p_channel: defaultNotifyChannel(),
      },
    );
    if (error) throw new Error(error.message);
    return data as string;
  },

  async getBookingForNotify(bookingId) {
    const { data: req } = await getSupabaseServerClient()
      .from("booking_requests")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!req) return null;

    const [{ data: client }, { data: course }, resources] = await Promise.all([
      getSupabaseServerClient().from("clients").select("*").eq("id", req.client_id).single(),
      getSupabaseServerClient().from("courses").select("*").eq("id", req.course_id).single(),
      getDataSource().then((ds) => ds.getResources()),
    ]);
    if (!client || !course) return null;

    let timeLabel: string | undefined;
    let resourceName: string | undefined;
    if (req.starts_at && req.ends_at && req.resource_id) {
      const res = resources.find((r) => r.id === req.resource_id);
      const slot: Slot = {
        id: "",
        course_id: req.course_id,
        resource_id: req.resource_id,
        starts_at: req.starts_at,
        ends_at: req.ends_at,
        capacity: 1,
        booked_count: 0,
        created_at: "",
        updated_at: "",
      };
      const view = toBookableSlot(slot, res);
      timeLabel = `${view.dayLabel} ${view.timeLabel}`;
      resourceName = view.resourceName;
    }

    return {
      clientName: client.name,
      clientEmail: client.email,
      courseName: course.name,
      bookingId: req.booking_id,
      timeLabel,
      resourceName,
    };
  },
};

// --- Demo --------------------------------------------------------------------

function demoResources() {
  return resources.filter((r) => r.is_active);
}

const demoAdmin: AdminDataSource = {
  async getInbox(status = "pending") {
    const filter =
      status === "all"
        ? () => true
        : (r: BookingRequest) => r.status === status;
    const reqs = demoRequests.filter(filter);
    const prefs = demoRequestSlots;
    const activeResources = demoResources();
    const activeCourses = courses.filter((c) => c.is_active);

    return reqs.map((req) =>
      buildInboxItem(
        req,
        demoClients.find((c) => c.id === req.client_id)!,
        activeCourses.find((c) => c.id === req.course_id)!,
        prefs.filter((p) => p.request_id === req.id),
        demoSlots,
        activeResources,
      ),
    );
  },

  async getManualSlotOptions() {
    const now = Date.now();
    const activeResources = demoResources();
    const activeCourses = courses.filter((c) => c.is_active);
    const out: ManualSlotOption[] = [];
    for (const c of activeCourses) {
      for (const slot of demoSlots) {
        if (
          slot.course_id !== c.id ||
          new Date(slot.starts_at).getTime() <= now ||
          slot.booked_count >= slot.capacity
        ) {
          continue;
        }
        const view = toBookableSlot(
          slot,
          activeResources.find((r) => r.id === slot.resource_id),
        );
        out.push({
          slotId: slot.id,
          courseId: c.id,
          courseName: c.name,
          dayLabel: view.dayLabel,
          timeLabel: view.timeLabel,
          resourceName: view.resourceName,
          remaining: slot.capacity - slot.booked_count,
          capacity: slot.capacity,
        });
      }
    }
    return out;
  },

  async approve(requestId, slotId) {
    const req = demoRequests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") throw new Error("request_not_pending");
    const slot = demoSlots.find((s) => s.id === slotId);
    if (!slot || slot.booked_count >= slot.capacity) throw new Error("slot_full");

    if (
      demoRequests.some(
        (r) =>
          r.status === "approved" &&
          r.resource_id === slot.resource_id &&
          r.starts_at &&
          r.ends_at &&
          r.starts_at < slot.ends_at &&
          r.ends_at > slot.starts_at,
      )
    ) {
      throw new Error("resource_overlap");
    }

    slot.booked_count += 1;
    req.status = "approved";
    req.resource_id = slot.resource_id;
    req.starts_at = slot.starts_at;
    req.ends_at = slot.ends_at;
    req.updated_at = new Date().toISOString();
    return req.booking_id;
  },

  async reject(requestId, reason) {
    const req = demoRequests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") throw new Error("request_not_pending");
    req.status = "rejected";
    if (reason) req.note = (req.note ? req.note + "\n" : "") + "拒絕原因:" + reason;
    return req.booking_id;
  },

  async cancel(requestId, reason) {
    const req = demoRequests.find((r) => r.id === requestId);
    if (!req || !["pending", "approved"].includes(req.status)) {
      throw new Error("request_not_cancellable");
    }
    if (req.status === "approved" && req.resource_id && req.starts_at) {
      const slot = demoSlots.find(
        (s) =>
          s.resource_id === req.resource_id &&
          s.starts_at === req.starts_at &&
          s.ends_at === req.ends_at,
      );
      if (slot) slot.booked_count = Math.max(0, slot.booked_count - 1);
    }
    req.status = "cancelled";
    if (reason) req.note = (req.note ? req.note + "\n" : "") + "取消原因:" + reason;
    return req.booking_id;
  },

  async manualBooking(slotId, name, phone, email, note) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error("phone_invalid");
    const slot = demoSlots.find((s) => s.id === slotId);
    if (!slot || slot.booked_count >= slot.capacity) throw new Error("slot_full");

    let client = demoClients.find((c) => c.phone === normalized);
    if (!client) {
      client = {
        id: `demo-client-${demoClients.length + 1}`,
        name: name.trim(),
        phone: normalized,
        email: email?.trim() || null,
        line_user_id: null,
        preferred_channel: defaultNotifyChannel(),
        auth_user_id: null,
        note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      demoClients.push(client);
    }

    slot.booked_count += 1;
    const bookingId = generateBookingId();
    demoRequests.push({
      id: `demo-req-${demoRequests.length + 1}`,
      client_id: client.id,
      booking_id: bookingId,
      status: "approved",
      course_id: slot.course_id,
      resource_id: slot.resource_id,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      note: note?.trim() || null,
      notify_channel: defaultNotifyChannel(),
      notified_at: null,
      gcal_event_id: null,
      company_gcal_event_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return bookingId;
  },

  async getBookingForNotify(bookingId) {
    const req = demoRequests.find((r) => r.booking_id === bookingId);
    if (!req) return null;
    const client = demoClients.find((c) => c.id === req.client_id);
    const course = courses.find((c) => c.id === req.course_id);
    if (!client || !course) return null;
    let timeLabel: string | undefined;
    let resourceName: string | undefined;
    if (req.starts_at && req.resource_id) {
      const res = demoResources().find((r) => r.id === req.resource_id);
      const view = toBookableSlot(
        {
          id: "",
          course_id: req.course_id,
          resource_id: req.resource_id,
          starts_at: req.starts_at,
          ends_at: req.ends_at!,
          capacity: 1,
          booked_count: 0,
          created_at: "",
          updated_at: "",
        },
        res,
      );
      timeLabel = `${view.dayLabel} ${view.timeLabel}`;
      resourceName = view.resourceName;
    }
    return {
      clientName: client.name,
      clientEmail: client.email,
      courseName: course.name,
      bookingId: req.booking_id,
      timeLabel,
      resourceName,
    };
  },
};

export async function getAdminDataSource(): Promise<AdminDataSource> {
  if (hasSupabaseEnv()) return supabaseAdmin;
  return demoAdmin;
}
