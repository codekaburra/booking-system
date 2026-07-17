/**
 * SQL 離線驗證(PGlite;本機沒有 psql)。
 *
 *   node scripts/check-sql.mjs
 *
 * 做的事:在記憶體 Postgres 依序套 0001…0005 + seed.sql,然後斷言分店(branches)
 * 相關的資料完整性與 RPC 行為。任何一條斷言失敗 → 非 0 離開碼。
 *
 * 這是 PROGRESS.md「把驗證腳本 commit 起來」的落實:任何人/AI 一行指令即可重驗。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = new URL("..", import.meta.url).pathname;
const MIGRATIONS = join(ROOT, "supabase/migrations");

let failures = 0;
let checks = 0;

function ok(name) {
  checks += 1;
  console.log(`  ✓ ${name}`);
}
function fail(name, detail) {
  checks += 1;
  failures += 1;
  console.error(`  ✗ ${name}\n      ${detail}`);
}
function assert(name, cond, detail = "") {
  if (cond) ok(name);
  else fail(name, detail);
}
function assertEq(name, actual, expected) {
  if (actual === expected) ok(name);
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/** 執行應該要拋錯的 SQL,回傳錯誤訊息(沒拋 → 回 null) */
async function expectRaise(db, sql, params) {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e.message ?? String(e);
  }
}

const db = new PGlite();
await db.waitReady;

// --- 套用 migrations + seed ---------------------------------------------------
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
}
await db.exec(readFileSync(join(ROOT, "supabase/seed.sql"), "utf8"));
console.log(`\n套用 ${files.join(", ")} + seed.sql — OK\n`);

const one = async (sql, params) => (await db.query(sql, params)).rows[0];

// --- 1. 分店存在 --------------------------------------------------------------
console.log("分店 / 回填:");
const branchCount = await one("select count(*)::int as n from public.branches");
assertEq("seed 建立 2 間分店", branchCount.n, 2);

const slugs = (
  await db.query("select slug from public.branches order by sort_order")
).rows.map((r) => r.slug);
assert(
  "分店 slug = neihu, taichung",
  JSON.stringify(slugs) === JSON.stringify(["neihu", "taichung"]),
  JSON.stringify(slugs),
);

// --- 2. 每一列都有 branch_id ---------------------------------------------------
for (const table of ["resources", "date_overrides", "slots", "booking_requests"]) {
  const r = await one(
    `select count(*)::int as n from public.${table} where branch_id is null`,
  );
  assertEq(`${table} 無 branch_id 為 null 的列`, r.n, 0);
}

// --- 3. slot.branch_id == 其 resource 的分店 ------------------------------------
const mismatch = await one(`
  select count(*)::int as n
  from public.slots s join public.resources r on r.id = s.resource_id
  where s.branch_id <> r.branch_id
`);
assertEq("每個 slot 的 branch_id 等於其 resource 的分店", mismatch.n, 0);

const ovMismatch = await one(`
  select count(*)::int as n
  from public.date_overrides o join public.resources r on r.id = o.resource_id
  where o.branch_id <> r.branch_id
`);
assertEq("資源級 date_override 的 branch_id 等於其 resource 的分店", ovMismatch.n, 0);

// --- 4. trigger:branch_id 不一致要被擋下 ---------------------------------------
console.log("\ntrigger(反正規化一致性):");
const neihu = await one("select id from public.branches where slug = 'neihu'");
const taichung = await one("select id from public.branches where slug = 'taichung'");
const xiaoming = "11111111-1111-4111-8111-000000000001"; // 內湖
const peipei = "11111111-1111-4111-8111-000000000003"; // 台中
const private90 = "22222222-2222-4222-8222-000000000001";

const badSlot = await expectRaise(
  db,
  `insert into public.slots (branch_id, course_id, resource_id, starts_at, ends_at, capacity)
   values ($1, $2, $3, now() + interval '30 days', now() + interval '30 days 90 minutes', 1)`,
  [taichung.id, private90, xiaoming], // 小明是內湖的 → 分店對不上
);
assert(
  "slot 的 branch_id 與 resource 分店不符 → branch_mismatch",
  badSlot?.includes("branch_mismatch"),
  String(badSlot),
);

// branch_id 留空 → trigger 自動由 resource 帶入
await db.query(
  `insert into public.slots (course_id, resource_id, starts_at, ends_at, capacity)
   values ($1, $2, now() + interval '31 days', now() + interval '31 days 90 minutes', 1)`,
  [private90, peipei],
);
const derived = await one(
  `select branch_id from public.slots where resource_id = $1
   order by starts_at desc limit 1`,
  [peipei],
);
assertEq("slot 的 branch_id 留空 → 自 resource 帶入", derived.branch_id, taichung.id);

// --- 5. date_overrides 唯一鍵含 branch_id --------------------------------------
console.log("\ndate_overrides 唯一鍵:");
const sameDateOtherBranch = await expectRaise(
  db,
  `insert into public.date_overrides (branch_id, date, resource_id, type, reason)
   values ($1, '2026-12-25', null, 'closed', '測試')`,
  [neihu.id],
);
assertEq("同日分店級公休(內湖)可新增", sameDateOtherBranch, null);
const otherBranchSameDate = await expectRaise(
  db,
  `insert into public.date_overrides (branch_id, date, resource_id, type, reason)
   values ($1, '2026-12-25', null, 'closed', '測試')`,
  [taichung.id],
);
assertEq("同日、不同分店 → 不衝突(唯一鍵已含 branch_id)", otherBranchSameDate, null);
const dupSameBranch = await expectRaise(
  db,
  `insert into public.date_overrides (branch_id, date, resource_id, type, reason)
   values ($1, '2026-12-25', null, 'closed', '重複')`,
  [neihu.id],
);
assert(
  "同日、同分店、同 type → 唯一鍵擋下",
  dupSameBranch?.includes("date_overrides_branch_date_resource_type_key"),
  String(dupSameBranch),
);

// --- 6. create_booking_request ------------------------------------------------
console.log("\ncreate_booking_request:");
// 未來的可約 slot(seed 的 slot 都在 2026-07 已過期 → 這裡自己建幾個)
const mk = async (resourceId, days, capacity = 1) =>
  (
    await db.query(
      `insert into public.slots (course_id, resource_id, starts_at, ends_at, capacity)
       values ($1, $2, now() + ($3 || ' days')::interval,
               now() + ($3 || ' days')::interval + interval '90 minutes', $4)
       returning id, branch_id`,
      [private90, resourceId, String(days), capacity],
    )
  ).rows[0];

const nSlotA = await mk(xiaoming, 60);
const nSlotB = await mk(xiaoming, 61);
const tSlot = await mk(peipei, 62);

const bookedBefore = await one(
  "select booked_count from public.slots where id = $1",
  [nSlotA.id],
);

const created = await one(
  `select public.create_booking_request($1, $2, $3, $4, $5, $6, $7) as booking_id`,
  [private90, [nSlotA.id, nSlotB.id], "測試客戶", "0911222333", null, null, "email"],
);
assert("同分店志願 → 建立成功", Boolean(created.booking_id), JSON.stringify(created));

const createdRow = await one(
  "select branch_id, status from public.booking_requests where booking_id = $1",
  [created.booking_id],
);
assertEq("建立的預約 branch_id = 志願 slot 的分店", createdRow.branch_id, neihu.id);
assertEq("建立的預約 status = pending", createdRow.status, "pending");

const bookedAfter = await one("select booked_count from public.slots where id = $1", [
  nSlotA.id,
]);
assertEq(
  "create 不動 booked_count(佔位只在 approve)",
  bookedAfter.booked_count,
  bookedBefore.booked_count,
);

const mixed = await expectRaise(
  db,
  `select public.create_booking_request($1, $2, $3, $4, $5, $6, $7)`,
  [private90, [nSlotA.id, tSlot.id], "跨店客戶", "0911222444", null, null, "email"],
);
assert(
  "志願跨分店 → mixed_branch",
  mixed?.includes("mixed_branch"),
  String(mixed),
);

const dup = await expectRaise(
  db,
  `select public.create_booking_request($1, $2, $3, $4, $5, $6, $7)`,
  [private90, [nSlotA.id, nSlotA.id], "重複客戶", "0911222555", null, null, "email"],
);
assert("志願重複 → duplicate_slot(0002 的防呆仍在)", dup?.includes("duplicate_slot"), String(dup));

// --- 7. approve:capacity + resource overlap ------------------------------------
console.log("\napprove(防超賣):");

// ⚠️ 順序很重要:競爭同一個 slot 的另外兩筆申請必須在 approve **之前**建立。
// approve 之後該 slot 已滿,create_booking_request 會在重驗階段就以
// slot_unavailable 擋掉(那是對的行為),就測不到 approve 自己的 slot_full 了。
// 這正是「位子只在 approve 時佔走」的兩段式設計:送出時檢查、approve 時才是定局。
const second = await one(
  `select public.create_booking_request($1, $2, $3, $4, $5, $6, $7) as booking_id`,
  [private90, [nSlotA.id], "第二位", "0911222666", null, null, "email"],
);
const secondId = await one(
  "select id from public.booking_requests where booking_id = $1",
  [second.booking_id],
);

// 同教練、時間重疊的另一個 slot(用來測 resource_overlap)
const overlapSlot = (
  await db.query(
    `insert into public.slots (course_id, resource_id, starts_at, ends_at, capacity)
     select $1, $2, s.starts_at + interval '30 minutes',
            s.ends_at + interval '30 minutes', 1
     from public.slots s where s.id = $3
     returning id`,
    [private90, xiaoming, nSlotA.id],
  )
).rows[0];
const third = await one(
  `select public.create_booking_request($1, $2, $3, $4, $5, $6, $7) as booking_id`,
  [private90, [overlapSlot.id], "第三位", "0911222777", null, null, "email"],
);
const thirdId = await one(
  "select id from public.booking_requests where booking_id = $1",
  [third.booking_id],
);

const reqRow = await one(
  "select id from public.booking_requests where booking_id = $1",
  [created.booking_id],
);
const approved = await one("select public.approve_booking_request($1, $2) as booking_id", [
  reqRow.id,
  nSlotA.id,
]);
assertEq("approve 成功", approved.booking_id, created.booking_id);

const afterApprove = await one(
  `select br.status, br.branch_id, br.resource_id, s.booked_count
   from public.booking_requests br join public.slots s on s.id = $2
   where br.id = $1`,
  [reqRow.id, nSlotA.id],
);
assertEq("approve 後 status = approved", afterApprove.status, "approved");
assertEq("approve 後 branch_id = slot 的分店", afterApprove.branch_id, neihu.id);
assertEq("approve 後 booked_count +1", afterApprove.booked_count, 1);

// capacity:同 slot 再 approve 第二筆 → slot_full
const full = await expectRaise(db, "select public.approve_booking_request($1, $2)", [
  secondId.id,
  nSlotA.id,
]);
assert("容量滿 → slot_full(capacity 檢查仍在)", full?.includes("slot_full"), String(full));

// resource overlap:同教練、時間重疊的另一個 slot(該 slot 本身還有空位)
const overlap = await expectRaise(db, "select public.approve_booking_request($1, $2)", [
  thirdId.id,
  overlapSlot.id,
]);
assert(
  "同資源時間重疊 → resource_overlap(重疊檢查仍在)",
  overlap?.includes("resource_overlap"),
  String(overlap),
);

// --- 8. create_manual_booking 帶 branch_id ------------------------------------
console.log("\ncreate_manual_booking:");
const manual = await one(
  "select public.create_manual_booking($1, $2, $3, $4, $5, $6) as booking_id",
  [tSlot.id, "手動客戶", "0911222888", null, null, "email"],
);
const manualRow = await one(
  "select branch_id, status from public.booking_requests where booking_id = $1",
  [manual.booking_id],
);
assertEq("手動約課 branch_id = slot 的分店(台中)", manualRow.branch_id, taichung.id);
assertEq("手動約課 status = approved", manualRow.status, "approved");

// --- 9. 回填路徑:既有單店資料(0001–0004)套上 0005 ----------------------------
// 上面那個資料庫是「空庫套 migrations 再跑 seed」= 全新部署。既有部署走的是另一條路:
// 已經有一堆沒有 branch_id 的資料 → 0005 必須建預設分店並把每一列指過去。
console.log("\n回填(既有單店資料 → 預設分店):");
{
  const old = new PGlite();
  await old.waitReady;
  for (const f of files.filter((f) => f < "0005")) {
    await old.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }

  // 舊格式資料(無 branch_id):1 教練、1 課程、全店公休、1 slot、
  // 1 筆 approved(有 resource_id)、1 筆 pending(只能靠 request_slots 推分店)
  await old.exec(`
    insert into public.resources (id, type, name)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 'instructor', '舊教練');
    insert into public.courses (id, name, duration_min, capacity)
      values ('bbbbbbbb-0000-4000-8000-000000000001', '舊課程', 90, 1);
    insert into public.date_overrides (date, resource_id, type, reason)
      values ('2026-01-01', null, 'closed', '元旦(舊全店級)');
    insert into public.slots (id, course_id, resource_id, starts_at, ends_at, capacity, booked_count)
      values ('cccccccc-0000-4000-8000-000000000001',
              'bbbbbbbb-0000-4000-8000-000000000001',
              'aaaaaaaa-0000-4000-8000-000000000001',
              '2026-08-01 10:00+08', '2026-08-01 11:30+08', 1, 1);
    insert into public.clients (id, name, phone)
      values ('dddddddd-0000-4000-8000-000000000001', '舊客戶', '0900000001');
    insert into public.booking_requests
      (id, client_id, booking_id, status, course_id, resource_id, starts_at, ends_at)
      values ('eeeeeeee-0000-4000-8000-000000000001',
              'dddddddd-0000-4000-8000-000000000001', 'BK-OLD-0001', 'approved',
              'bbbbbbbb-0000-4000-8000-000000000001',
              'aaaaaaaa-0000-4000-8000-000000000001',
              '2026-08-01 10:00+08', '2026-08-01 11:30+08');
    insert into public.booking_requests
      (id, client_id, booking_id, status, course_id)
      values ('eeeeeeee-0000-4000-8000-000000000002',
              'dddddddd-0000-4000-8000-000000000001', 'BK-OLD-0002', 'pending',
              'bbbbbbbb-0000-4000-8000-000000000001');
    insert into public.request_slots (request_id, slot_id, preference_order)
      values ('eeeeeeee-0000-4000-8000-000000000002',
              'cccccccc-0000-4000-8000-000000000001', 1);
  `);

  await old.exec(readFileSync(join(MIGRATIONS, "0005_branches.sql"), "utf8"));

  const oneOld = async (sql) => (await old.query(sql)).rows[0];
  const b = await oneOld("select id, slug, name from public.branches");
  assertEq("既有資料 → 建立 1 間預設分店", (await oneOld("select count(*)::int as n from public.branches")).n, 1);
  assertEq("預設分店 slug = main", b.slug, "main");

  for (const table of ["resources", "date_overrides", "slots", "booking_requests"]) {
    const r = await oneOld(
      `select count(*)::int as n from public.${table} where branch_id is null or branch_id <> '${b.id}'`,
    );
    assertEq(`${table} 全部回填為預設分店`, r.n, 0);
  }

  // pending 那筆沒有 resource_id → 必須靠 request_slots → slots 推導出分店
  const pending = await oneOld(
    "select branch_id from public.booking_requests where booking_id = 'BK-OLD-0002'",
  );
  assertEq("pending 預約經 request_slots → slots 推導出 branch_id", pending.branch_id, b.id);

  // 舊的「全店級」公休(resource_id = null)→ 成為預設分店的分店級公休
  const ov = await oneOld(
    "select branch_id, resource_id from public.date_overrides where date = '2026-01-01'",
  );
  assertEq("舊全店級 override → 掛到預設分店(resource_id 仍為 null)", ov.resource_id, null);
  assertEq("舊全店級 override 的 branch_id = 預設分店", ov.branch_id, b.id);

  // 佔位數不因 migration 而變動
  const bc = await oneOld(
    "select booked_count from public.slots where id = 'cccccccc-0000-4000-8000-000000000001'",
  );
  assertEq("migration 不動 booked_count", bc.booked_count, 1);

  await old.close();
}

// --- 總結 ---------------------------------------------------------------------
console.log(
  `\n${failures === 0 ? "全部通過" : "有失敗"}:${checks - failures}/${checks}\n`,
);
process.exit(failures === 0 ? 0 : 1);
