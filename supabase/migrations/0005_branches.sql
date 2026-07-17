-- ============================================================================
-- 0005_branches.sql — 分店(branches;PLAN.md §14)
--
-- 這**不是**多租戶 / 多店:一個事業 = 一次部署 = 一個品牌 = 一組後台 = 一份客戶名單,
-- 底下有多個實體「分店」,分店是 DATA(後台可維護),不是部署單位。
--
-- 模型:
--   - resources.branch_id       每個資源(教練/房間)只屬於一間分店(NOT NULL)。
--   - courses                   **共用型錄**,不分店(價格/時長/容量為全事業一致)→ 不加 branch_id。
--   - clients                   **全事業共用**(同一人可在任何分店預約)→ 不加 branch_id。
--   - availability_rules        branch 可由 resource_id 推導 → 不加 branch_id。
--   - date_overrides.branch_id  公休/假日屬於某分店;resource_id 仍可空,語意由
--                               「全店」變更為「**該分店全店**」。全事業假日匯入 =
--                               每間啟用分店各一列。
--   - slots.branch_id           自 resource 反正規化(每分店週曆查詢用),NOT NULL。
--   - booking_requests.branch_id 一筆預約只發生在一間分店,NOT NULL。
--
-- date_overrides 優先權合約(0001 的版本在此更新,取代「全店」的說法):
--   1. date_overrides > availability_rules
--   2. override 之間:closed > special_hours > extra_open
--   3. 層級之間:資源級(resource_id 有值)> **分店級**(resource_id 為 null)
--   分店級 extra_open 只延伸「當日已有排班」的資源;要替未排班的特定資源加開,
--   用資源級 extra_open。分店級 special_hours = 與該分店各資源 rules 的交集
--   (不會無中生有地開出當天沒排班的資源)。
--
-- 0001–0004 已凍結;所有變更只在本檔。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------------
create table public.branches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                        -- 顯示名(例:台北內湖店)
  slug       text not null unique,                 -- 網址 / 選擇器用識別碼
  address    text,
  timezone   text not null default 'Asia/Taipei',  -- 台灣的分店一律 Asia/Taipei
  is_active  boolean not null default true,
  sort_order integer not null default 0,           -- 選擇器排序(小的在前)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger branches_set_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

create index branches_active_sort_idx
  on public.branches (is_active, sort_order, name);

alter table public.branches enable row level security;  -- 同 0001:deny-all

-- ---------------------------------------------------------------------------
-- 新欄位(先可空,回填後再上 NOT NULL)
-- ---------------------------------------------------------------------------
alter table public.resources
  add column branch_id uuid references public.branches (id) on delete restrict;

alter table public.date_overrides
  add column branch_id uuid references public.branches (id) on delete cascade;

alter table public.slots
  add column branch_id uuid references public.branches (id) on delete restrict;

alter table public.booking_requests
  add column branch_id uuid references public.branches (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 回填(既有單店資料 → 一間預設分店)
--
-- 只有在「本來就有資料」時才建預設分店:全新資料庫(migrations 尚未跑 seed)
-- 不該憑空多出一間分店,由 seed.sql / 後台自行建立。
-- 店名不寫死在此(shop.config.ts 才是品牌設定的唯一來源):用通用名稱「本店」,
-- slug = 'main';既有部署套用後由老闆在後台改名即可。
-- ---------------------------------------------------------------------------
do $$
declare
  v_branch_id uuid;
  v_has_data  boolean;
begin
  select
    exists (select 1 from public.resources)
    or exists (select 1 from public.date_overrides)
    or exists (select 1 from public.slots)
    or exists (select 1 from public.booking_requests)
  into v_has_data;

  if not v_has_data then
    return;
  end if;

  insert into public.branches (name, slug, sort_order)
  values ('本店', 'main', 0)
  returning id into v_branch_id;

  update public.resources       set branch_id = v_branch_id where branch_id is null;
  update public.date_overrides  set branch_id = v_branch_id where branch_id is null;
  update public.slots           set branch_id = v_branch_id where branch_id is null;

  -- booking_requests 回填順序:
  --   1. 已確定資源(approved / 模式 B)→ 取該 resource 的分店
  --   2. 否則(pending)→ 由志願 slot 推導(request_slots → slots → branch_id)
  --   3. 都推不出來 → 預設分店
  update public.booking_requests br
  set branch_id = r.branch_id
  from public.resources r
  where br.branch_id is null
    and br.resource_id = r.id;

  update public.booking_requests br
  set branch_id = sub.branch_id
  from (
    select rs.request_id, min(s.branch_id::text)::uuid as branch_id
    from public.request_slots rs
    join public.slots s on s.id = rs.slot_id
    group by rs.request_id
  ) sub
  where br.branch_id is null
    and br.id = sub.request_id;

  update public.booking_requests set branch_id = v_branch_id where branch_id is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- NOT NULL(回填之後)
-- ---------------------------------------------------------------------------
alter table public.resources        alter column branch_id set not null;
alter table public.date_overrides   alter column branch_id set not null;
alter table public.slots            alter column branch_id set not null;
alter table public.booking_requests alter column branch_id set not null;

-- ---------------------------------------------------------------------------
-- date_overrides 唯一約束:原本 (date, resource_id, type) 是「全店唯一」,
-- 現在同一天不同分店可以各有一列(例:只有台中店颱風停業)→ 必須含 branch_id。
-- nulls not distinct:分店級(resource_id = null)同樣受唯一約束。
-- ---------------------------------------------------------------------------
alter table public.date_overrides
  drop constraint date_overrides_date_resource_type_key;

alter table public.date_overrides
  add constraint date_overrides_branch_date_resource_type_key
  unique nulls not distinct (branch_id, date, resource_id, type);

-- ---------------------------------------------------------------------------
-- 索引(每分店查詢)
-- ---------------------------------------------------------------------------
create index resources_branch_id_idx
  on public.resources (branch_id);

create index slots_branch_starts_at_idx
  on public.slots (branch_id, starts_at);

create index date_overrides_branch_date_idx
  on public.date_overrides (branch_id, date);

create index booking_requests_branch_status_idx
  on public.booking_requests (branch_id, status);

-- ---------------------------------------------------------------------------
-- 一致性:slots.branch_id / date_overrides.branch_id 必須等於其 resource 的分店。
--
-- 這兩欄是反正規化(為了「不 join resources 就能查某分店的週曆」)。反正規化的
-- 代價就是可能對不上,所以在 DB 這一層強制:
--   - branch_id 留空 → 由 resource 自動帶入(生成器 / 舊呼叫端不必改也不會錯)
--   - branch_id 有值但與 resource 的分店不同 → raise,直接擋下
-- (date_overrides 的 resource_id 為 null = 分店級,無從推導,呼叫端必須自己給。)
--
-- 未涵蓋:資源事後被搬到別間分店 → 既有 slots 不會自動跟著搬。搬資源屬於後台
-- 操作,應連同該資源未來的 slots 一起處理(P6 slot 生成 / 後台搬遷流程負責)。
-- ---------------------------------------------------------------------------
create or replace function public.sync_branch_id_from_resource()
returns trigger
language plpgsql
as $$
declare
  v_branch_id uuid;
begin
  if new.resource_id is null then
    return new;  -- date_overrides 分店級:呼叫端已給 branch_id(NOT NULL 會擋)
  end if;

  select branch_id into v_branch_id
  from public.resources
  where id = new.resource_id;

  if v_branch_id is null then
    raise exception 'resource_not_found' using errcode = 'check_violation';
  end if;

  if new.branch_id is null then
    new.branch_id := v_branch_id;
  elsif new.branch_id <> v_branch_id then
    raise exception 'branch_mismatch' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger slots_sync_branch_id
  before insert or update of resource_id, branch_id on public.slots
  for each row execute function public.sync_branch_id_from_resource();

create trigger date_overrides_sync_branch_id
  before insert or update of resource_id, branch_id on public.date_overrides
  for each row execute function public.sync_branch_id_from_resource();

-- ============================================================================
-- RPC 更新:三個會寫入 booking_requests 的函式現在都必須帶 branch_id。
-- 以 create or replace 覆蓋 0002 / 0003 的版本(0002 / 0003 檔案本身不動)。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- create_booking_request(取代 0002 版本)
--
-- 與 0002 的差異**只有**:
--   (a) 新增 mixed_branch 防呆:所有志願 slot 必須同屬一間分店
--       (一筆預約只發生在一間分店;跨分店志願無法在 approve 時決定分店)。
--   (b) booking_requests 寫入時帶 branch_id(取自志願 slot 的分店)。
-- 其餘一律保留:志願去重、手機歸戶(race-safe on conflict)、slot 逐一重驗、
-- booking_id 衝突重試、**不動 booked_count**(佔位只在 approve)。
-- ---------------------------------------------------------------------------
create or replace function public.create_booking_request(
  p_course_id  uuid,
  p_slot_ids   uuid[],           -- 依志願序排列(元素 1 = 第一志願)
  p_name       text,
  p_phone      text,             -- 已由應用層正規化為純數字 10 碼
  p_email      text default null,
  p_note       text default null,
  p_channel    text default 'email'
)
returns text
language plpgsql
as $$
declare
  v_client_id   uuid;
  v_request_id  uuid;
  v_booking_id  text;
  v_slot_id     uuid;
  v_pref        integer;
  v_alphabet    constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; -- Crockford base32
  v_code        text;
  v_i           integer;
  v_attempt     integer;
  v_date_part   text;
  v_branch_id   uuid;
  v_branch_cnt  integer;
begin
  -- --- 基本形狀防呆(應用層已驗過,這裡是最後防線)---
  if p_name is null or btrim(p_name) = '' then
    raise exception 'name_required' using errcode = 'check_violation';
  end if;
  if p_phone is null or p_phone !~ '^09\d{8}$' then
    raise exception 'phone_invalid' using errcode = 'check_violation';
  end if;
  if p_slot_ids is null or array_length(p_slot_ids, 1) is null then
    raise exception 'slots_required' using errcode = 'check_violation';
  end if;

  -- --- 志願不可重複(同一 slot 不能同時是第 1、第 2 志願)---
  if (select count(*) from unnest(p_slot_ids)) <>
     (select count(distinct x) from unnest(p_slot_ids) as t(x)) then
    raise exception 'duplicate_slot' using errcode = 'check_violation';
  end if;

  -- --- 分店一致性:所有志願必須同一間分店 ---
  -- 一筆 booking_requests 只有一個 branch_id;若志願跨分店,approve 時無從決定
  -- 這筆預約算哪一間 → 直接在送出時擋掉。
  select count(distinct s.branch_id), min(s.branch_id::text)::uuid
  into v_branch_cnt, v_branch_id
  from public.slots s
  where s.id = any(p_slot_ids);

  if v_branch_cnt > 1 then
    raise exception 'mixed_branch' using errcode = 'check_violation';
  end if;

  -- --- 1. 依手機歸戶(dedup;race-safe)---
  insert into public.clients (name, phone, email, preferred_channel, note)
  values (btrim(p_name), p_phone, nullif(btrim(coalesce(p_email, '')), ''),
          coalesce(p_channel, 'email'), null)
  on conflict (phone) do nothing
  returning id into v_client_id;

  if v_client_id is null then
    select id into v_client_id from public.clients where phone = p_phone;
    update public.clients
    set name  = case when btrim(p_name) <> '' then btrim(p_name) else name end,
        email = case
                  when nullif(btrim(coalesce(p_email, '')), '') is not null
                    then btrim(p_email)
                  else email
                end
    where id = v_client_id
      and (
        (btrim(p_name) <> '' and btrim(p_name) is distinct from name)
        or (nullif(btrim(coalesce(p_email, '')), '') is distinct from email
            and nullif(btrim(coalesce(p_email, '')), '') is not null)
      );
  end if;

  -- --- 2. 逐一重新驗證選取的 slot(競態防線;不動 booked_count)---
  foreach v_slot_id in array p_slot_ids loop
    perform 1
    from public.slots s
    where s.id = v_slot_id
      and s.course_id = p_course_id
      and s.starts_at > now()              -- 未來(now() 為 UTC instant,與台北同一時刻)
      and s.booked_count < s.capacity;     -- 尚有空位
    if not found then
      raise exception 'slot_unavailable:%', v_slot_id
        using errcode = 'check_violation';
    end if;
  end loop;

  -- 走到這裡代表每個 slot 都存在 → branch_id 必然有值(slots.branch_id NOT NULL)
  if v_branch_id is null then
    raise exception 'branch_unresolved' using errcode = 'check_violation';
  end if;

  -- --- 3. 產生 booking_id(台北日期 + 4 碼 base32,衝突重試)---
  v_date_part := to_char(timezone('Asia/Taipei', now()), 'YYYYMMDD');
  for v_attempt in 1..10 loop
    v_code := '';
    for v_i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    v_booking_id := 'BK-' || v_date_part || '-' || v_code;

    begin
      -- --- 4. 建 booking_requests(pending;resource/時間留 NULL;branch_id 有值)---
      insert into public.booking_requests
        (client_id, booking_id, status, course_id, branch_id, note, notify_channel)
      values
        (v_client_id, v_booking_id, 'pending', p_course_id, v_branch_id,
         nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_channel, 'email'))
      returning id into v_request_id;
      exit; -- 插入成功 → 跳出重試迴圈
    exception when unique_violation then
      if v_attempt = 10 then
        raise exception 'booking_id_collision' using errcode = 'unique_violation';
      end if;
    end;
  end loop;

  -- --- request_slots(帶志願序)---
  v_pref := 1;
  foreach v_slot_id in array p_slot_ids loop
    insert into public.request_slots (request_id, slot_id, preference_order)
    values (v_request_id, v_slot_id, v_pref);
    v_pref := v_pref + 1;
  end loop;

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_booking_request(取代 0003 版本)
--
-- 與 0003 的差異**只有**:approve 時一併把 slot 的 branch_id 寫回申請
-- (pending 時的 branch_id 來自志願 slot,理論上相同;此處以最終 slot 為準)。
-- 兩道防超賣關卡原封不動:
--   1. capacity:booked_count < capacity(slot 列已 for update 鎖住)
--   2. 資源級時間重疊:同 resource 不可有另一筆 approved 重疊
-- ---------------------------------------------------------------------------
create or replace function public.approve_booking_request(
  p_request_id uuid,
  p_slot_id    uuid
)
returns text  -- booking_id
language plpgsql
as $$
declare
  v_req         public.booking_requests%rowtype;
  v_slot        public.slots%rowtype;
  v_booking_id  text;
begin
  select * into v_req
  from public.booking_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'request_not_found' using errcode = 'check_violation';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request_not_pending' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.request_slots
    where request_id = p_request_id and slot_id = p_slot_id
  ) then
    raise exception 'slot_not_preference' using errcode = 'check_violation';
  end if;

  -- 鎖定 slot 列(防併發超賣)
  select * into v_slot
  from public.slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'slot_not_found' using errcode = 'check_violation';
  end if;
  if v_slot.course_id <> v_req.course_id then
    raise exception 'slot_course_mismatch' using errcode = 'check_violation';
  end if;
  if v_slot.booked_count >= v_slot.capacity then
    raise exception 'slot_full' using errcode = 'check_violation';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'slot_past' using errcode = 'check_violation';
  end if;

  -- 資源級時間重疊:同 resource 不可有另一筆 approved 重疊
  -- (資源只屬於一間分店,故此檢查自然是分店內的;不需再比 branch_id)
  if exists (
    select 1 from public.booking_requests br
    where br.resource_id = v_slot.resource_id
      and br.status = 'approved'
      and br.starts_at < v_slot.ends_at
      and br.ends_at > v_slot.starts_at
  ) then
    raise exception 'resource_overlap' using errcode = 'check_violation';
  end if;

  -- 佔位 + 寫回申請
  update public.slots
  set booked_count = booked_count + 1
  where id = p_slot_id;

  update public.booking_requests
  set status      = 'approved',
      resource_id = v_slot.resource_id,
      branch_id   = v_slot.branch_id,
      starts_at   = v_slot.starts_at,
      ends_at     = v_slot.ends_at
  where id = p_request_id
  returning booking_id into v_booking_id;

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_manual_booking(取代 0003 版本)
--
-- 與 0003 的差異**只有**:insert booking_requests 時帶 slot 的 branch_id。
-- capacity + 資源重疊兩道檢查原封不動。
-- ---------------------------------------------------------------------------
create or replace function public.create_manual_booking(
  p_slot_id   uuid,
  p_name      text,
  p_phone     text,
  p_email     text default null,
  p_note      text default null,
  p_channel   text default 'email'
)
returns text  -- booking_id
language plpgsql
as $$
declare
  v_client_id   uuid;
  v_slot        public.slots%rowtype;
  v_request_id  uuid;
  v_booking_id  text;
  v_alphabet    constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_code        text;
  v_i           integer;
  v_attempt     integer;
  v_date_part   text;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'name_required' using errcode = 'check_violation';
  end if;
  if p_phone is null or p_phone !~ '^09\d{8}$' then
    raise exception 'phone_invalid' using errcode = 'check_violation';
  end if;

  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then raise exception 'slot_not_found' using errcode = 'check_violation'; end if;
  if v_slot.booked_count >= v_slot.capacity then
    raise exception 'slot_full' using errcode = 'check_violation';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'slot_past' using errcode = 'check_violation';
  end if;

  -- 資源重疊檢查
  if exists (
    select 1 from public.booking_requests br
    where br.resource_id = v_slot.resource_id
      and br.status = 'approved'
      and br.starts_at < v_slot.ends_at
      and br.ends_at > v_slot.starts_at
  ) then
    raise exception 'resource_overlap' using errcode = 'check_violation';
  end if;

  -- 客戶歸戶(race-safe,同 0002)
  insert into public.clients (name, phone, email, preferred_channel, note)
  values (btrim(p_name), p_phone, nullif(btrim(coalesce(p_email, '')), ''),
          coalesce(p_channel, 'email'), null)
  on conflict (phone) do nothing
  returning id into v_client_id;

  if v_client_id is null then
    select id into v_client_id from public.clients where phone = p_phone;
    update public.clients
    set name  = case when btrim(p_name) <> '' then btrim(p_name) else name end,
        email = case
                  when nullif(btrim(coalesce(p_email, '')), '') is not null
                    then btrim(p_email) else email end
    where id = v_client_id;
  end if;

  -- booking_id 產生(同 0002)
  v_date_part := to_char(timezone('Asia/Taipei', now()), 'YYYYMMDD');
  for v_attempt in 1..10 loop
    v_code := '';
    for v_i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    v_booking_id := 'BK-' || v_date_part || '-' || v_code;
    begin
      insert into public.booking_requests
        (client_id, booking_id, status, course_id, resource_id, branch_id,
         starts_at, ends_at, note, notify_channel)
      values
        (v_client_id, v_booking_id, 'approved', v_slot.course_id,
         v_slot.resource_id, v_slot.branch_id, v_slot.starts_at, v_slot.ends_at,
         nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_channel, 'email'))
      returning id into v_request_id;
      exit;
    exception when unique_violation then
      if v_attempt = 10 then
        raise exception 'booking_id_collision' using errcode = 'unique_violation';
      end if;
    end;
  end loop;

  update public.slots set booked_count = booked_count + 1 where id = p_slot_id;

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reject_booking_request / cancel_booking_request:
-- 只改 status / note(cancel 另外 booked_count -1),不新增列、不動 resource,
-- 因此不受 branch_id 影響 → 0003 的版本原封不動,本檔不重寫。
-- ---------------------------------------------------------------------------
