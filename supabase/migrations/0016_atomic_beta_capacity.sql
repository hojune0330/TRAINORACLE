create table if not exists public.beta_capacity_controls (
  capacity_key text primary key check (capacity_key = 'PUBLIC_BETA'),
  seat_limit integer not null check (seat_limit = 200),
  created_at timestamptz not null default clock_timestamp()
);

insert into public.beta_capacity_controls (capacity_key, seat_limit)
values ('PUBLIC_BETA', 200)
on conflict (capacity_key) do nothing;

create table if not exists public.beta_enrollments (
  user_id uuid primary key references auth.users (id) on delete cascade,
  capacity_key text not null default 'PUBLIC_BETA'
    references public.beta_capacity_controls (capacity_key),
  admitted_at timestamptz not null default clock_timestamp(),
  check (capacity_key = 'PUBLIC_BETA')
);

do $$
begin
  if (select count(*) from public.user_private_profiles) > 200 then
    raise exception 'existing beta profiles exceed the 200-seat limit';
  end if;
end;
$$;

insert into public.beta_enrollments (user_id, admitted_at)
select profile.user_id, profile.created_at
from public.user_private_profiles profile
on conflict (user_id) do nothing;

alter table public.beta_capacity_controls enable row level security;
alter table public.beta_enrollments enable row level security;

revoke all on table public.beta_capacity_controls from public;
revoke all on table public.beta_capacity_controls from anon;
revoke all on table public.beta_capacity_controls from authenticated;
revoke all on table public.beta_enrollments from public;
revoke all on table public.beta_enrollments from anon;
revoke all on table public.beta_enrollments from authenticated;

revoke insert on table public.user_private_profiles from authenticated;
revoke insert (user_id, birth_date) on table public.user_private_profiles from authenticated;
revoke update on table public.user_private_profiles from authenticated;
revoke update (birth_date) on table public.user_private_profiles from authenticated;

create or replace function public.claim_beta_seat(birth_date_input date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  capacity_limit integer;
  occupied_seats integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if birth_date_input is null or birth_date_input > current_date then
    raise exception 'invalid birth date';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests request
    where request.user_id = auth.uid()
  ) then
    return 'ACCOUNT_BLOCKED';
  end if;

  select capacity.seat_limit
  into capacity_limit
  from public.beta_capacity_controls capacity
  where capacity.capacity_key = 'PUBLIC_BETA'
  for update;

  if capacity_limit is null then
    raise exception 'beta capacity is not configured';
  end if;

  if exists (
    select 1
    from public.beta_enrollments enrollment
    where enrollment.user_id = auth.uid()
  ) then
    insert into public.user_private_profiles (user_id, birth_date, updated_at)
    values (auth.uid(), birth_date_input, clock_timestamp())
    on conflict (user_id) do update
    set birth_date = excluded.birth_date,
        updated_at = excluded.updated_at
    where user_private_profiles.deletion_requested_at is null;
    return 'ADMITTED_EXISTING';
  end if;

  select count(*)
  into occupied_seats
  from public.beta_enrollments;

  if occupied_seats >= capacity_limit then
    return 'BETA_FULL';
  end if;

  insert into public.beta_enrollments (user_id)
  values (auth.uid());

  insert into public.user_private_profiles (user_id, birth_date, updated_at)
  values (auth.uid(), birth_date_input, clock_timestamp())
  on conflict (user_id) do update
  set birth_date = excluded.birth_date,
      updated_at = excluded.updated_at
  where user_private_profiles.deletion_requested_at is null;

  return 'ADMITTED_NEW';
end;
$$;

revoke all on function public.claim_beta_seat(date) from public;
revoke all on function public.claim_beta_seat(date) from anon;
revoke all on function public.claim_beta_seat(date) from authenticated;
grant execute on function public.claim_beta_seat(date) to authenticated;

create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select auth.uid() = target_user
    and exists (
      select 1
      from public.beta_enrollments enrollment
      where enrollment.user_id = target_user
    )
    and public.athlete_support_access_allowed(target_user);
$$;
