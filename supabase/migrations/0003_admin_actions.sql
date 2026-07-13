-- ============================================================================
-- 0003_admin_actions.sql — P4 管理後台交易函式
--
-- approve_booking_request  — 確認志願(capacity + 資源時間重疊檢查)
-- reject_booking_request   — 拒絕申請
-- cancel_booking_request   — 取消(approved 時 booked_count -1)
-- create_manual_booking    — 手動約課(直接 approved,跳過 pending)
--
-- 全部以 .rpc() + service role 呼叫(P1 RLS deny-all)。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- approve:確認某一志願 slot
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
  -- 鎖定申請列
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

  -- 必須是此申請的志願之一
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
      starts_at   = v_slot.starts_at,
      ends_at     = v_slot.ends_at
  where id = p_request_id
  returning booking_id into v_booking_id;

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reject:拒絕申請(不動 booked_count)
-- ---------------------------------------------------------------------------
create or replace function public.reject_booking_request(
  p_request_id uuid,
  p_reason     text default null
)
returns text  -- booking_id
language plpgsql
as $$
declare
  v_booking_id text;
begin
  update public.booking_requests
  set status = 'rejected',
      note   = case
                 when nullif(btrim(coalesce(p_reason, '')), '') is not null
                   then coalesce(note || E'\n', '') || '拒絕原因:' || btrim(p_reason)
                 else note
               end
  where id = p_request_id and status = 'pending'
  returning booking_id into v_booking_id;

  if not found then
    raise exception 'request_not_pending' using errcode = 'check_violation';
  end if;

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel:取消(pending 直接標 cancelled;approved 則 booked_count -1)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking_request(
  p_request_id uuid,
  p_reason     text default null
)
returns text  -- booking_id
language plpgsql
as $$
declare
  v_req        public.booking_requests%rowtype;
  v_booking_id text;
  v_slot_id    uuid;
begin
  select * into v_req
  from public.booking_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'request_not_found' using errcode = 'check_violation';
  end if;
  if v_req.status not in ('pending', 'approved') then
    raise exception 'request_not_cancellable' using errcode = 'check_violation';
  end if;

  -- approved:找到對應 slot 並釋出位子
  if v_req.status = 'approved' then
    select id into v_slot_id
    from public.slots
    where resource_id = v_req.resource_id
      and course_id   = v_req.course_id
      and starts_at   = v_req.starts_at
      and ends_at     = v_req.ends_at
    for update;

    if found then
      update public.slots
      set booked_count = greatest(booked_count - 1, 0)
      where id = v_slot_id;
    end if;
  end if;

  update public.booking_requests
  set status = 'cancelled',
      note   = case
                 when nullif(btrim(coalesce(p_reason, '')), '') is not null
                   then coalesce(note || E'\n', '') || '取消原因:' || btrim(p_reason)
                 else note
               end
  where id = p_request_id
  returning booking_id into v_booking_id;

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- manual:手動約課(電話/LINE/現場),直接 approved
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

  -- 鎖定 slot
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
        (client_id, booking_id, status, course_id, resource_id,
         starts_at, ends_at, note, notify_channel)
      values
        (v_client_id, v_booking_id, 'approved', v_slot.course_id,
         v_slot.resource_id, v_slot.starts_at, v_slot.ends_at,
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
