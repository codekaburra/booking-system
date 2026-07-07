-- ============================================================================
-- 0001_init.sql — 預約系統 8 張表(PLAN.md §5)
--
-- clients ──< booking_requests ──< request_slots >── slots >── resources
--                      │(approved 後帶 resource_id            └────── courses
--                      │  + starts_at/ends_at)
-- availability_rules ── resources
-- date_overrides ────── resources(可空 = 全店)
--
-- 約定:
-- - 時間戳一律 timestamptz(UTC 儲存);顯示層轉 Asia/Taipei。
-- - date / time 欄位為 Asia/Taipei 當地日期與牆上時間(rules / overrides)。
-- - status / type 用 CHECK constraint(比 enum 好改)。
-- - 每店分開部署,不需 shop_id 與多租戶 RLS;但仍啟用 RLS(deny-all),
--   P1–P3 由 server 端以 service role 存取,P4+ 再依角色開 policy。
-- ============================================================================

-- gen_random_uuid() 為 PostgreSQL 13+ 內建,毋需 extension

-- ---------------------------------------------------------------------------
-- updated_at 自動維護
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clients(客戶;手機號歸戶)
-- ---------------------------------------------------------------------------
create table public.clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  phone             text not null unique, -- 必填、唯一:同手機 = 同一人
  email             text,
  line_user_id      text,
  preferred_channel text not null default 'email'
                    check (preferred_channel in ('email', 'whatsapp', 'line')),
  auth_user_id      uuid unique, -- 登入後綁 Supabase Auth(auth.users.id);訪客留空
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- auth_user_id → auth.users FK:
-- Supabase 上 auth schema 必存在,會加上 FK;
-- 本地 PGlite 驗證環境沒有 auth schema,偵測不到就跳過(unique 仍然生效)。
do $$
begin
  if to_regclass('auth.users') is not null then
    alter table public.clients
      add constraint clients_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users (id) on delete set null;
  end if;
end;
$$;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- courses(課程 / 服務項目)
-- ---------------------------------------------------------------------------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  duration_min integer not null check (duration_min > 0), -- 上課時長(分鐘)
  capacity     integer not null check (capacity > 0),     -- 每堂容納人數
  price        integer not null default 0 check (price >= 0), -- 新台幣元
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- resources(可預約資源:教練 / 房間 / 器材)
-- ---------------------------------------------------------------------------
create table public.resources (
  id               uuid primary key default gen_random_uuid(),
  type             text not null
                   check (type in ('instructor', 'room', 'equipment')),
  name             text not null,
  photo            text,
  color            text, -- 週曆顯示顏色(hex;UI 僅用於色條/圓點)
  is_active        boolean not null default true, -- 停用 = 離職 / 維修
  gcal_calendar_id text, -- 公司為此資源建立的 Google 行事曆 ID(P7)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- availability_rules(開放時間,每週重複;每個資源各自的開放時段)
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6), -- 0=週日…6=週六
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  check (start_time < end_time)
);

create index availability_rules_resource_id_idx
  on public.availability_rules (resource_id, weekday);

-- ---------------------------------------------------------------------------
-- date_overrides(特殊日期:國定假日 / 公休 / 請假 / 加開)
-- 優先權合約(P2 週曆與 P5 slot 生成都必須照此解讀):
--   1. date_overrides > availability_rules
--   2. override 之間:closed > special_hours > extra_open
--   3. 層級之間:資源級(resource_id 有值)> 全店級(resource_id 為 null)
-- ---------------------------------------------------------------------------
create table public.date_overrides (
  id          uuid primary key default gen_random_uuid(),
  date        date not null, -- Asia/Taipei 當地日期
  resource_id uuid references public.resources (id) on delete cascade,
              -- 可空 = 全店(國定假日、公休);指定 = 單一資源(請假、維修)
  type        text not null
              check (type in ('closed', 'special_hours', 'extra_open')),
  start_time  time,
  end_time    time,
  reason      text, -- 顯示用(春節、颱風、請假…)
  created_at  timestamptz not null default now(),
  -- closed 不需時段;special_hours / extra_open 必須有合法時段
  check (
    (type = 'closed' and start_time is null and end_time is null)
    or (
      type in ('special_hours', 'extra_open')
      and start_time is not null
      and end_time is not null
      and start_time < end_time
    )
  )
);

-- 防同日同資源同 type 重複(假日匯入重跑、老闆重複新增)
-- nulls not distinct:全店級(resource_id = null)同樣受唯一約束
alter table public.date_overrides
  add constraint date_overrides_date_resource_type_key
  unique nulls not distinct (date, resource_id, type);

create index date_overrides_date_resource_idx
  on public.date_overrides (date, resource_id);

-- ---------------------------------------------------------------------------
-- slots(實際時段;模式 A 用,由 rules × 課程時長生成)
-- ---------------------------------------------------------------------------
create table public.slots (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete restrict,
  resource_id  uuid not null references public.resources (id) on delete restrict,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  capacity     integer not null check (capacity > 0),
  booked_count integer not null default 0 check (booked_count >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (starts_at < ends_at),
  check (booked_count <= capacity), -- 防超賣底線(approve 仍須 transaction 檢查)
  -- 防 cron 滾動生成重跑 / 併發時插出重複 slot;生成邏輯用 on conflict do nothing
  unique (resource_id, course_id, starts_at)
);

create index slots_resource_id_starts_at_idx
  on public.slots (resource_id, starts_at);

create index slots_starts_at_idx
  on public.slots (starts_at);

create trigger slots_set_updated_at
  before update on public.slots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- booking_requests(預約;兩模式共用)
-- 模式 A:pending → approve 時把選定 slot 的 resource/時間寫回本表
-- 模式 B:建立時即 approved,resource_id + starts_at/ends_at 直接有值,
--         防重疊檢查靠這兩欄(transaction 內檢查同 resource 無時間重疊)
-- ---------------------------------------------------------------------------
create table public.booking_requests (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients (id) on delete restrict,
  booking_id            text not null unique, -- 對外公開碼(例 BK-20260630-A1B2)
  status                text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  course_id             uuid not null references public.courses (id) on delete restrict,
  resource_id           uuid references public.resources (id) on delete restrict,
  starts_at             timestamptz,
  ends_at               timestamptz,
  note                  text,
  notify_channel        text check (notify_channel in ('email', 'whatsapp', 'line')),
  notified_at           timestamptz,
  gcal_event_id         text, -- 資源行事曆事件(P7)
  company_gcal_event_id text, -- 公司總行事曆事件(P7)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and starts_at < ends_at)
  )
);

create index booking_requests_client_id_idx
  on public.booking_requests (client_id);

create index booking_requests_status_idx
  on public.booking_requests (status);

-- 模式 B 防重疊查詢用:同 resource、approved 的時間範圍
-- P8 實作模式 B 時應評估升級為 DB 層保證:
--   create extension btree_gist;
--   alter table ... add constraint ... exclude using gist
--     (resource_id with =, tstzrange(starts_at, ends_at) with &&)
--     where (status = 'approved');
create index booking_requests_resource_time_idx
  on public.booking_requests (resource_id, starts_at, ends_at)
  where resource_id is not null and status = 'approved';

create trigger booking_requests_set_updated_at
  before update on public.booking_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- request_slots(申請 ↔ 多個志願時段;模式 A)
-- ---------------------------------------------------------------------------
create table public.request_slots (
  request_id       uuid not null references public.booking_requests (id) on delete cascade,
  slot_id          uuid not null references public.slots (id) on delete cascade,
  preference_order integer not null check (preference_order >= 1), -- 志願序 1、2、3…
  primary key (request_id, slot_id),
  unique (request_id, preference_order)
);

create index request_slots_slot_id_idx
  on public.request_slots (slot_id);

-- ---------------------------------------------------------------------------
-- RLS:先全部啟用、不開任何 policy(deny-all)。
-- P1–P3 一律由 server 以 service role 存取;P4+(Auth 進來後)再開 policy。
-- ---------------------------------------------------------------------------
alter table public.clients            enable row level security;
alter table public.courses            enable row level security;
alter table public.resources          enable row level security;
alter table public.availability_rules enable row level security;
alter table public.date_overrides     enable row level security;
alter table public.slots              enable row level security;
alter table public.booking_requests   enable row level security;
alter table public.request_slots      enable row level security;
