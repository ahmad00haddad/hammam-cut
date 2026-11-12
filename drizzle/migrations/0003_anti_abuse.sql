-- Phase 7: anti-abuse + UX.
-- 1) pending bookings expire (2h, or when start time passes) so fake requests cannot hold slots forever
-- 2) global cap on open pending requests
-- 3) cancelled bookings count toward the 24h limit (book/cancel loops are no longer free)
-- 4) IP fingerprint no longer trusts the client-supplied first x-forwarded-for entry
-- 5) Jordanian mobile format enforced (07[789]xxxxxxx)
-- 6) min_notice_minutes exposed to the public state
-- Apply once in the Supabase SQL editor. Safe to re-run.

create or replace function public.expire_pending() returns void
language sql security definer set search_path = public as $$
  update public.bookings
  set status = 'rejected', decided_at = now(), reject_reason = 'انتهت مهلة المراجعة'
  where status = 'pending' and (created_at < now() - interval '2 hours' or start_at < now());
$$;

drop function if exists public.get_public_state(date);
create or replace function public.get_public_state(_day date)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.settings;
  day_start timestamptz := (_day::timestamp at time zone 'Asia/Amman');
  day_end timestamptz := ((_day + 1)::timestamp at time zone 'Asia/Amman');
  busy jsonb;
begin
  perform public.expire_pending();
  select * into s from public.settings where id = 1;
  select coalesce(jsonb_agg(jsonb_build_array(x.a, x.b)), '[]'::jsonb) into busy from (
    select start_at as a, end_at as b from public.bookings
      where status in ('pending', 'approved', 'done') and start_at < day_end and end_at > day_start
    union all
    select start_at, end_at from public.blocks where start_at < day_end and end_at > day_start
    union all
    select now(), s.pause_until where s.pause_until is not null and s.pause_until > now()
  ) x;
  return jsonb_build_object(
    'enabled', s.booking_enabled,
    'pause_until', case when s.pause_until > now() then s.pause_until end,
    'pause_reason', case when s.pause_until > now() then s.pause_reason end,
    'service_minutes', s.service_minutes,
    'buffer_minutes', s.buffer_minutes,
    'open_min', s.open_min,
    'close_min', s.close_min,
    'days_off', to_jsonb(s.days_off),
    'window_days', s.booking_window_days,
    'max_party', s.max_party_size,
    'min_notice', s.min_notice_minutes,
    'busy', busy
  );
end $$;
grant execute on function public.get_public_state(date) to anon, authenticated;

create or replace function public.create_booking(
  _name text, _phone text, _start timestamptz,
  _party_size int default 1, _device_id text default null, _party_names text[] default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
  local_ts timestamp := _start at time zone 'Asia/Amman';
  mins int := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  step int;
  v_end timestamptz;
  v_phone text := right(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), 9);
  v_ip text;
  v_hdr json;
  v_raw text;
  v_xff text[];
  v_dev text := nullif(left(trim(coalesce(_device_id, '')), 64), '');
  used int;
  first_at timestamptz;
  open_pending int;
  new_id uuid;
  new_token uuid;
  new_status text;
begin
  perform public.expire_pending();
  select * into s from public.settings where id = 1;
  step := s.service_minutes + s.buffer_minutes;

  if not s.booking_enabled then raise exception 'booking off'; end if;
  if length(trim(coalesce(_name, ''))) < 2 or length(trim(_name)) > 60 then raise exception 'invalid name'; end if;
  if v_phone !~ '^7[789][0-9]{7}$' or length(_phone) > 20 then raise exception 'invalid phone'; end if;
  if _party_size < 1 or _party_size > s.max_party_size then raise exception 'invalid party'; end if;
  if _party_names is not null and array_length(_party_names, 1) > s.max_party_size then raise exception 'invalid party'; end if;
  if _party_names is not null and exists (select 1 from unnest(_party_names) n where length(coalesce(n, '')) > 60) then raise exception 'invalid party'; end if;

  if _start < now() + (s.min_notice_minutes * interval '1 minute') - interval '5 minutes' then raise exception 'past slot'; end if;
  if _start > now() + (s.booking_window_days * interval '1 day') + interval '1 day' then raise exception 'too far'; end if;
  if extract(isodow from local_ts)::int = any (s.days_off) then raise exception 'closed day'; end if;
  if mins < s.open_min or (mins - s.open_min) % step <> 0 or extract(second from local_ts) <> 0 then raise exception 'invalid time'; end if;

  v_end := _start + (step * _party_size) * interval '1 minute';
  if mins + (step * _party_size - s.buffer_minutes) > s.close_min then raise exception 'after closing'; end if;
  if s.pause_until is not null and _start < s.pause_until then raise exception 'paused'; end if;
  if exists (select 1 from public.blocks b where b.start_at < v_end and b.end_at > _start) then raise exception 'blocked period'; end if;

  if exists (select 1 from public.blocked_clients c
             where (c.kind = 'phone' and c.value = v_phone) or (c.kind = 'device' and c.value = v_dev)) then
    raise exception 'not allowed';
  end if;

  -- global cap on unreviewed requests
  select count(*) into open_pending from public.bookings where status = 'pending' and walk_in = false;
  if open_pending >= 12 then raise exception 'too many pending'; end if;

  -- IP: x-real-ip, else the LAST x-forwarded-for entry (added by the trusted proxy), never the first (client-forgeable).
  begin
    v_hdr := current_setting('request.headers', true)::json;
    v_xff := string_to_array(coalesce(v_hdr ->> 'x-forwarded-for', ''), ',');
    v_raw := coalesce(nullif(v_hdr ->> 'x-real-ip', ''), trim(v_xff[array_length(v_xff, 1)]));
    v_ip := case when coalesce(v_raw, '') = '' then null else md5(v_raw) end;
  exception when others then v_ip := null;
  end;

  -- per phone / device limit in the last 24h (cancelled count; rejected do not)
  select count(*), min(created_at) into used, first_at from public.bookings
  where created_at > now() - interval '24 hours'
    and status <> 'rejected'
    and walk_in = false
    and (phone_norm = v_phone or (v_dev is not null and device_id = v_dev));
  if used >= s.max_bookings_per_device_24h then
    raise exception 'limit reached %', to_char((first_at + interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
  -- IP is shared by many users behind carrier NAT, so it gets a looser cap (8 per 24h)
  if v_ip is not null and (select count(*) from public.bookings
      where created_at > now() - interval '24 hours' and ip_hash = v_ip and walk_in = false and status <> 'rejected') >= 8 then
    raise exception 'limit reached %', to_char((now() + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  new_status := case when s.auto_approve then 'approved' else 'pending' end;
  insert into public.bookings(customer_name, phone, phone_norm, start_at, end_at, party_size, party_names,
                              device_id, ip_hash, status)
  values (trim(_name), trim(_phone), v_phone, _start, v_end, _party_size, _party_names, v_dev, v_ip, new_status)
  returning id, public_token into new_id, new_token;

  return jsonb_build_object('id', new_id, 'token', new_token, 'status', new_status);
exception when exclusion_violation then
  raise exception 'slot taken';
end $$;
grant execute on function public.create_booking(text, text, timestamptz, int, text, text[]) to anon, authenticated;

-- one Telegram message per cancellation
alter table public.bookings add column if not exists cancel_notified_at timestamptz;
