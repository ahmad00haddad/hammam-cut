-- Booking system v2: settings, parties, device limits, approval flow, blocks.
-- Apply once in the Supabase SQL editor (or via Lovable). Safe to read top to bottom.

-- ───────────── settings (single row) ─────────────
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  booking_enabled boolean not null default true,
  pause_until timestamptz,
  pause_reason text,
  service_minutes int not null default 20 check (service_minutes between 5 and 120),
  buffer_minutes int not null default 5 check (buffer_minutes between 0 and 60),
  open_min int not null default 720,
  close_min int not null default 1320,
  days_off int[] not null default '{1}',
  booking_window_days int not null default 7 check (booking_window_days between 1 and 60),
  max_party_size int not null default 4 check (max_party_size between 1 and 10),
  max_bookings_per_device_24h int not null default 2 check (max_bookings_per_device_24h between 1 and 20),
  auto_approve boolean not null default false,
  min_notice_minutes int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;
grant select, insert, update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "admin all" on public.settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
alter publication supabase_realtime add table public.settings;

-- ───────────── blocks (manual closed periods) ─────────────
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  reason text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy "admin all" on public.blocks for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ───────────── blocked clients (phones / devices) ─────────────
create table if not exists public.blocked_clients (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('phone', 'device')),
  value text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (kind, value)
);
grant select, insert, update, delete on public.blocked_clients to authenticated;
grant all on public.blocked_clients to service_role;
alter table public.blocked_clients enable row level security;
create policy "admin all" on public.blocked_clients for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ───────────── bookings: new columns ─────────────
alter table public.bookings
  add column if not exists party_size int not null default 1 check (party_size between 1 and 10),
  add column if not exists party_names text[],
  add column if not exists end_at timestamptz,
  add column if not exists device_id text,
  add column if not exists phone_norm text,
  add column if not exists ip_hash text,
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists decided_at timestamptz,
  add column if not exists reject_reason text,
  add column if not exists admin_note text;

-- legacy rows: 'booked' becomes 'approved'; old slots were 20 min
update public.bookings set status = 'approved' where status = 'booked';
update public.bookings set end_at = start_at + interval '20 minutes' where end_at is null;
update public.bookings set phone_norm = right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9)
  where phone_norm is null and phone is not null;
alter table public.bookings alter column end_at set not null;
alter table public.bookings alter column status set default 'pending';
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'approved', 'done', 'rejected', 'cancelled', 'no_show'));

-- Overlap protection replaces the old unique index on start_at.
drop index if exists public.bookings_active_slot;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (tstzrange(start_at, end_at) with &&)
  where (status in ('pending', 'approved', 'done'));

create index if not exists bookings_start_idx on public.bookings(start_at);
create index if not exists bookings_device_idx on public.bookings(device_id, created_at);
create index if not exists bookings_phone_idx on public.bookings(phone_norm, created_at);

-- Fill end_at / phone_norm automatically (admin walk-ins insert directly).
create or replace function public.bookings_fill()
returns trigger language plpgsql set search_path = public as $$
declare s public.settings;
begin
  select * into s from public.settings where id = 1;
  if new.end_at is null then
    new.end_at := new.start_at + ((s.service_minutes + s.buffer_minutes) * new.party_size) * interval '1 minute';
  end if;
  if new.phone is not null then
    new.phone_norm := right(regexp_replace(new.phone, '\D', '', 'g'), 9);
  end if;
  return new;
end $$;
drop trigger if exists bookings_fill_trg on public.bookings;
create trigger bookings_fill_trg before insert on public.bookings
  for each row execute function public.bookings_fill();

-- ───────────── public state (no personal data) ─────────────
drop function if exists public.get_taken_slots(date);

create or replace function public.get_public_state(_day date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.settings;
  day_start timestamptz := (_day::timestamp at time zone 'Asia/Amman');
  day_end timestamptz := ((_day + 1)::timestamp at time zone 'Asia/Amman');
  busy jsonb;
begin
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
    'busy', busy
  );
end $$;
grant execute on function public.get_public_state(date) to anon, authenticated;

-- ───────────── create booking (all rules enforced here) ─────────────
drop function if exists public.create_booking(text, text, timestamptz);

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

-- customer checks / cancels their own booking by private token
create or replace function public.get_booking_status(_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', status, 'start_at', start_at, 'party_size', party_size, 'reject_reason', reject_reason)
  from public.bookings where public_token = _token
$$;
grant execute on function public.get_booking_status(uuid) to anon, authenticated;

create or replace function public.cancel_my_booking(_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set status = 'cancelled'
  where public_token = _token and status in ('pending', 'approved') and start_at > now();
  return found;
end $$;
grant execute on function public.cancel_my_booking(uuid) to anon, authenticated;

-- admin: simple stats
create or replace function public.get_stats(_from date, _to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'total', count(*),
    'done', count(*) filter (where status = 'done'),
    'no_show', count(*) filter (where status = 'no_show'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'rejected', count(*) filter (where status = 'rejected'),
    'people', coalesce(sum(party_size) filter (where status = 'done'), 0),
    'unique_clients', count(distinct phone_norm) filter (where status = 'done'),
    'by_hour', coalesce((select jsonb_object_agg(h, c) from (
        select extract(hour from start_at at time zone 'Asia/Amman')::int as h, count(*) as c
        from public.bookings where status = 'done'
          and (start_at at time zone 'Asia/Amman')::date between _from and _to group by 1) q), '{}'::jsonb),
    'by_weekday', coalesce((select jsonb_object_agg(d, c) from (
        select extract(isodow from start_at at time zone 'Asia/Amman')::int as d, count(*) as c
        from public.bookings where status = 'done'
          and (start_at at time zone 'Asia/Amman')::date between _from and _to group by 1) q), '{}'::jsonb)
  ) into r
  from public.bookings
  where (start_at at time zone 'Asia/Amman')::date between _from and _to;
  return r;
end $$;
grant execute on function public.get_stats(date, date) to authenticated;