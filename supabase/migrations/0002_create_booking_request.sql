-- ============================================================================
-- 0002_create_booking_request.sql — 模式 A 送出預約的交易函式(P3)
--
-- 為什麼用 DB 函式:Supabase JS 沒有 client 端交易 API。把「客戶歸戶 +
-- 建 booking_requests + 建 request_slots」包成單一 plpgsql 函式,以 .rpc()
-- 呼叫,確保**原子性**(全成功或全失敗)。
--
-- 本函式做的事:
--   0. 志願去重防呆:p_slot_ids 內出現重複 slot → 直接 raise duplicate_slot。
--      (最終仍由 request_slots PK (request_id, slot_id) 保證;這裡先回清楚錯誤。)
--   1. 依手機歸戶:phone 命中既有 client → 重用;否則新建。**race-safe**:
--      用 insert ... on conflict (phone) do nothing + 回查,避免兩筆同手機併發
--      送出時第二筆撞 unique 拋原始 DB 錯誤。(有提供且不同才更新 name/email。)
--   2. 逐一重新驗證選取 slot:仍存在、屬於本課程、未來(以 DB now() 判斷)、
--      且 booked_count < capacity。任何一個不合 → RAISE 例外、整筆 rollback。
--      注意:此處**不**動 booked_count(佔位只在 P4 approve 時發生)。
--   3. 產生 booking_id(BK-YYYYMMDD-XXXX,日期以 Asia/Taipei);
--      碰上 unique 衝突自動重試,最多 10 次。
--      base32 字母表(去 I/L/O/U)與 src/lib/booking/booking-id.ts 保持一致。
--   4. 插入 booking_requests(status='pending',resource/starts_at/ends_at 留 NULL)
--      與 request_slots(帶 preference_order)。
--
-- 回傳:booking_id(text)。
-- 呼叫端(supabase-source.ts)以 service role 呼叫(P1 RLS deny-all)。
-- ============================================================================

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
  -- DB 層已由 request_slots 的 PK (request_id, slot_id) 保證唯一;此處先擋,
  -- 回傳清楚的 duplicate_slot,而非讓後段 insert 撞 PK 拋原始 DB 錯誤。
  -- (validate.ts 亦有同層防呆 → 三層:應用層 / 本函式 / DB PK。)
  if (select count(*) from unnest(p_slot_ids)) <>
     (select count(distinct x) from unnest(p_slot_ids) as t(x)) then
    raise exception 'duplicate_slot' using errcode = 'check_violation';
  end if;

  -- --- 1. 依手機歸戶(dedup;race-safe)---
  -- 兩筆「同一支新手機」併發送出:各自 select 都查不到 → 都 insert →
  -- 第二筆撞 clients.phone unique 會拋原始 DB 錯誤(雙擊即可觸發)。
  -- 改用 insert ... on conflict (phone) do nothing + 回查:衝突時第二筆
  -- 不拋錯、改回查既有(或併發交易剛提交的)client id。
  insert into public.clients (name, phone, email, preferred_channel, note)
  values (btrim(p_name), p_phone, nullif(btrim(coalesce(p_email, '')), ''),
          coalesce(p_channel, 'email'), null)
  on conflict (phone) do nothing
  returning id into v_client_id;

  if v_client_id is null then
    -- 既有客戶(本來就存在,或併發交易剛插入):回查取得 id
    select id into v_client_id from public.clients where phone = p_phone;
    -- 有提供且不同才更新 name / email(不覆寫成空)
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

  -- --- 3. 產生 booking_id(台北日期 + 4 碼 base32,衝突重試)---
  v_date_part := to_char(timezone('Asia/Taipei', now()), 'YYYYMMDD');
  for v_attempt in 1..10 loop
    v_code := '';
    for v_i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    v_booking_id := 'BK-' || v_date_part || '-' || v_code;

    begin
      -- --- 4. 建 booking_requests(pending;resource/時間留 NULL)---
      insert into public.booking_requests
        (client_id, booking_id, status, course_id, note, notify_channel)
      values
        (v_client_id, v_booking_id, 'pending', p_course_id,
         nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_channel, 'email'))
      returning id into v_request_id;
      exit; -- 插入成功 → 跳出重試迴圈
    exception when unique_violation then
      if v_attempt = 10 then
        raise exception 'booking_id_collision' using errcode = 'unique_violation';
      end if;
      -- 否則換一組 code 重試
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
