/**
 * 客戶端資料層(P5) — 我的預約、查詢碼回查、登入綁定。
 */

import "server-only";

import type {
  BookingRequest,
  Client,
  Course,
  RequestSlot,
  Slot,
} from "@/types/db";
import { buildBookingDetail } from "@/lib/client/build-booking-detail";
import type { BookingDetailView } from "@/lib/client/booking-view";
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
import { courses, resources } from "@/lib/data/demo-generator";

export interface ClientDataSource {
  findClientById(id: string): Promise<Client | null>;
  findClientByPhone(phone: string): Promise<Client | null>;
  findClientByAuthUserId(authUserId: string): Promise<Client | null>;
  linkOrCreateClient(
    authUserId: string,
    name: string,
    phone: string,
    email?: string,
  ): Promise<Client>;
  getBookingByCode(bookingId: string, phone: string): Promise<BookingDetailView | null>;
  getBookingsForClient(clientId: string): Promise<BookingDetailView[]>;
}

// --- Supabase ----------------------------------------------------------------

const supabaseClient: ClientDataSource = {
  async findClientById(id) {
    const { data, error } = await getSupabaseServerClient()
      .from("clients")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Client | null) ?? null;
  },

  async findClientByPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const { data, error } = await getSupabaseServerClient()
      .from("clients")
      .select("*")
      .eq("phone", normalized)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Client | null) ?? null;
  },

  async findClientByAuthUserId(authUserId) {
    const { data, error } = await getSupabaseServerClient()
      .from("clients")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Client | null) ?? null;
  },

  async linkOrCreateClient(authUserId, name, phone, email) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error("phone_invalid");
    const existing = await this.findClientByPhone(normalized);
    if (existing) {
      const { data, error } = await getSupabaseServerClient()
        .from("clients")
        .update({
          auth_user_id: authUserId,
          name: name.trim() || existing.name,
          email: email?.trim() || existing.email,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as Client;
    }
    const { data, error } = await getSupabaseServerClient()
      .from("clients")
      .insert({
        name: name.trim(),
        phone: normalized,
        email: email?.trim() || null,
        auth_user_id: authUserId,
        preferred_channel: defaultNotifyChannel(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Client;
  },

  async getBookingByCode(bookingId, phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const { data: req } = await getSupabaseServerClient()
      .from("booking_requests")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!req) return null;
    const { data: client } = await getSupabaseServerClient()
      .from("clients")
      .select("*")
      .eq("id", req.client_id)
      .single();
    if (!client || client.phone !== normalized) return null;
    return loadBookingDetail(req as BookingRequest);
  },

  async getBookingsForClient(clientId) {
    const { data: reqs, error } = await getSupabaseServerClient()
      .from("booking_requests")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!reqs?.length) return [];
    return Promise.all((reqs as BookingRequest[]).map(loadBookingDetail));
  },
};

async function loadBookingDetail(req: BookingRequest): Promise<BookingDetailView> {
  const ds = await getDataSource();
  const [client, course, resourcesList, prefRows] = await Promise.all([
    getSupabaseServerClient().from("clients").select("*").eq("id", req.client_id).single(),
    getSupabaseServerClient().from("courses").select("*").eq("id", req.course_id).single(),
    ds.getResources(),
    getSupabaseServerClient()
      .from("request_slots")
      .select("*")
      .eq("request_id", req.id)
      .order("preference_order"),
  ]);
  const slotIds = (prefRows.data ?? []).map((p) => p.slot_id);
  const { data: slotRows } = slotIds.length
    ? await getSupabaseServerClient().from("slots").select("*").in("id", slotIds)
    : { data: [] as Slot[] };
  return buildBookingDetail(
    req,
    client.data as Client,
    course.data as Course,
    (prefRows.data ?? []) as RequestSlot[],
    (slotRows ?? []) as Slot[],
    resourcesList,
  );
}

// --- Demo --------------------------------------------------------------------

const demoClient: ClientDataSource = {
  async findClientById(id) {
    return demoClients.find((c) => c.id === id) ?? null;
  },

  async findClientByPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return demoClients.find((c) => c.phone === normalized) ?? null;
  },

  async findClientByAuthUserId() {
    return null;
  },

  async linkOrCreateClient(_authUserId, name, phone, email) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error("phone_invalid");
    let client = demoClients.find((c) => c.phone === normalized);
    if (client) {
      if (name.trim()) client.name = name.trim();
      if (email?.trim()) client.email = email.trim();
      client.updated_at = new Date().toISOString();
      return client;
    }
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
    return client;
  },

  async getBookingByCode(bookingId, phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const req = demoRequests.find((r) => r.booking_id === bookingId);
    if (!req) return null;
    const client = demoClients.find((c) => c.id === req.client_id);
    if (!client || client.phone !== normalized) return null;
    return buildDemoDetail(req);
  },

  async getBookingsForClient(clientId) {
    return demoRequests
      .filter((r) => r.client_id === clientId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(buildDemoDetail);
  },
};

function buildDemoDetail(req: BookingRequest): BookingDetailView {
  const client = demoClients.find((c) => c.id === req.client_id)!;
  const course = courses.find((c) => c.id === req.course_id)!;
  const prefs = demoRequestSlots.filter((p) => p.request_id === req.id);
  const activeResources = resources.filter((r) => r.is_active);
  return buildBookingDetail(req, client, course, prefs, demoSlots, activeResources);
}

export async function getClientDataSource(): Promise<ClientDataSource> {
  if (hasSupabaseEnv()) return supabaseClient;
  return demoClient;
}
