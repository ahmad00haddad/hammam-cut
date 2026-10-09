create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- first registered user becomes the barber (admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text,
  start_at timestamptz not null,
  status text not null default 'booked',
  walk_in boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index bookings_active_slot on public.bookings(start_at) where status <> 'cancelled';
grant select, insert, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "admin all" on public.bookings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

alter publication supabase_realtime add table public.bookings;

-- public: taken slots for a day (no personal data)
create or replace function public.get_taken_slots(_day date)
returns setof timestamptz language sql stable security definer set search_path = public as $$
  select start_at from public.bookings
  where status <> 'cancelled'
    and (start_at at time zone 'Asia/Amman')::date = _day
$$;
grant execute on function public.get_taken_slots(date) to anon, authenticated;

-- public: create booking with validation
create or replace function public.create_booking(_name text, _phone text, _start timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  local_ts timestamp := _start at time zone 'Asia/Amman';
  mins int := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  new_id uuid;
begin
  if length(trim(coalesce(_name,''))) < 2 or length(trim(_name)) > 60 then raise exception 'invalid name'; end if;
  if length(regexp_replace(coalesce(_phone,''), '\D', '', 'g')) < 7 or length(_phone) > 20 then raise exception 'invalid phone'; end if;
  if _start < now() - interval '5 minutes' then raise exception 'past slot'; end if;
  if _start > now() + interval '30 days' then raise exception 'too far'; end if;
  if extract(isodow from local_ts) = 1 then raise exception 'closed monday'; end if;
  if mins < 720 or mins > 1300 or mins % 20 <> 0 or extract(second from local_ts) <> 0 then raise exception 'invalid time'; end if;
  insert into public.bookings(customer_name, phone, start_at) values (trim(_name), trim(_phone), _start) returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'slot taken';
end $$;
grant execute on function public.create_booking(text, text, timestamptz) to anon, authenticated;