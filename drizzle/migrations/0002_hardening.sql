-- Phase 6 hardening.
-- 1) bookings.notified_at: a booking triggers at most one Telegram notification.
-- 2) create_booking: reject party names longer than 60 characters.
-- Apply once (Lovable chat or Supabase SQL editor). Safe to re-run.

alter table public.bookings add column if not exists notified_at timestamptz;

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
  v_dev text := nullif(left(trim(coalesce(_device_id, '')), 64), '');
  used int;
  first_at timestamptz;
  new_id uuid;
  new_token uuid;
  new_status text;
begin
  select * into s from public.settings where id = 1;
  step := s.service_minutes + s.buffer_minutes;

  if not s.booking_enabled then raise exception 'booking off'; end if;
  if length(trim(coalesce(_name, ''))) < 2 or length(trim(_name)) > 60 then raise exception 'invalid name'; end if;
  if length(v_phone) < 7 or length(_phone) > 20 then raise exception 'invalid phone'; end if;
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

  begin
    v_ip := md5(coalesce(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''));
  exception when others then v_ip := null;
  end;

  -- per device / phone / IP limit in the last 24h
  select count(*), min(created_at) into used, first_at from public.bookings
  where created_at > now() - interval '24 hours'
    and status not in ('cancelled', 'rejected')
    and walk_in = false
    and (phone_norm = v_phone
      or (v_dev is not null and device_id = v_dev)
      or (v_ip is not null and ip_hash = v_ip));
  if used >= s.max_bookings_per_device_24h then
    raise exception 'limit reached %', to_char((first_at + interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
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
