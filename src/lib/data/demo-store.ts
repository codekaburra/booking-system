/**
 * Demo 模式共用可變狀態(P5)。
 * demo.ts / admin.ts / client.ts 共用,讓送出預約、後台審核、我的預約一致。
 *
 * 分店:demoClients 是**全事業共用**(不分店);demoRequests 每筆帶 branch_id,
 * 一律取自其 slot 的分店(與 0005 的 RPC 同一條規則)。
 */

import type { BookingRequest, Client, RequestSlot } from "@/types/db";
import { defaultNotifyChannel } from "@/config/shop.config";
import { generateSlots } from "@/lib/data/demo-generator";
import { taipeiToday } from "@/lib/tz";

const SEEDED_AT = "2026-07-06T00:00:00+08:00";
const DEMO_TODAY = taipeiToday();
export const demoSlots = generateSlots(DEMO_TODAY);

export const demoClients: Client[] = [
  {
    id: "33333333-3333-4333-8333-000000000001",
    name: "王小美",
    phone: "0912345678",
    email: "xiaomei@example.com",
    line_user_id: null,
    preferred_channel: "email",
    auth_user_id: null,
    note: null,
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: "33333333-3333-4333-8333-000000000002",
    name: "陳大明",
    phone: "0987654321",
    email: "daming@example.com",
    line_user_id: null,
    preferred_channel: "email",
    auth_user_id: null,
    note: "初學者",
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
  {
    id: "33333333-3333-4333-8333-000000000003",
    name: "林雅婷",
    phone: "0933222111",
    email: null,
    line_user_id: null,
    preferred_channel: "email",
    auth_user_id: null,
    note: "電話約課常客",
    created_at: SEEDED_AT,
    updated_at: SEEDED_AT,
  },
];

export const demoRequests: BookingRequest[] = [];
export const demoRequestSlots: RequestSlot[] = [];

/** 示範用已確認預約(陳大明,團體課) */
(function seedDemoBookings() {
  const groupCandidates = demoSlots.filter(
    (s) =>
      s.course_id === "22222222-2222-4222-8222-000000000002" &&
      s.booked_count < s.capacity &&
      new Date(s.starts_at).getTime() > Date.now(),
  );
  if (groupCandidates.length === 0) return;
  // 三個志願必須同分店(mixed_branch 規則)→ 收斂到第一個志願所在的分店
  const groupSlots = groupCandidates.filter(
    (s) => s.branch_id === groupCandidates[0].branch_id,
  );

  const pendingId = "55555555-5555-4555-8555-000000000002";
  demoRequests.push({
    id: pendingId,
    client_id: "33333333-3333-4333-8333-000000000002",
    booking_id: "BK-DEMO-PENDING1",
    status: "pending",
    course_id: groupSlots[0].course_id,
    // 志願必須同分店 → 下方 slice(0,3) 也只取同一分店的 slot
    branch_id: groupSlots[0].branch_id,
    resource_id: null,
    starts_at: null,
    ends_at: null,
    note: "第一次滑雪,平日下午佳",
    notify_channel: "email",
    notified_at: new Date().toISOString(),
    gcal_event_id: null,
    company_gcal_event_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  groupSlots.slice(0, 3).forEach((s, i) => {
    demoRequestSlots.push({
      request_id: pendingId,
      slot_id: s.id,
      preference_order: i + 1,
    });
  });

  const approvedSlot = demoSlots.find(
    (s) =>
      s.course_id === "22222222-2222-4222-8222-000000000001" &&
      s.booked_count === 0 &&
      new Date(s.starts_at).getTime() > Date.now(),
  );
  if (approvedSlot) {
    approvedSlot.booked_count = 1;
    demoRequests.push({
      id: "55555555-5555-4555-8555-000000000001",
      client_id: "33333333-3333-4333-8333-000000000001",
      booking_id: "BK-DEMO-APPROV1",
      status: "approved",
      course_id: approvedSlot.course_id,
      branch_id: approvedSlot.branch_id,
      resource_id: approvedSlot.resource_id,
      starts_at: approvedSlot.starts_at,
      ends_at: approvedSlot.ends_at,
      note: null,
      notify_channel: defaultNotifyChannel(),
      notified_at: new Date().toISOString(),
      gcal_event_id: null,
      company_gcal_event_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
})();
