create or replace function public.oracle_comparison_snapshot_is_safe(payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  item jsonb;
  field_count integer;
  unique_field_count integer;
  energy_key_count integer;
  unique_energy_key_count integer;
begin
  if jsonb_typeof(payload) <> 'object'
    or not (payload ?& array[
      'schemaVersion', 'sharedFields', 'record', 'recent8WeekDistanceKm',
      'structuredSessionCount', 'energySessionCounts'
    ])
    or payload - array[
      'schemaVersion', 'sharedFields', 'record', 'recent8WeekDistanceKm',
      'structuredSessionCount', 'energySessionCounts'
    ] <> '{}'::jsonb
    or payload -> 'schemaVersion' <> '1'::jsonb
    or jsonb_typeof(payload -> 'sharedFields') <> 'array'
    or jsonb_typeof(payload -> 'energySessionCounts') <> 'array'
  then
    return false;
  end if;

  select count(*), count(distinct value)
  into field_count, unique_field_count
  from jsonb_array_elements_text(payload -> 'sharedFields');
  if field_count < 1 or field_count > 3 or field_count <> unique_field_count
    or exists (
      select 1 from jsonb_array_elements_text(payload -> 'sharedFields') field
      where field not in ('BEST_RECORD', 'RECENT_DISTANCE', 'ENERGY_HISTORY')
    )
  then
    return false;
  end if;

  if (payload -> 'sharedFields' ? 'BEST_RECORD') <> (payload -> 'record' <> 'null'::jsonb)
    or (payload -> 'sharedFields' ? 'RECENT_DISTANCE') <> (payload -> 'recent8WeekDistanceKm' <> 'null'::jsonb)
    or (payload -> 'sharedFields' ? 'ENERGY_HISTORY') <> (payload -> 'structuredSessionCount' <> 'null'::jsonb)
  then
    return false;
  end if;

  if payload -> 'record' <> 'null'::jsonb then
    if jsonb_typeof(payload -> 'record') <> 'object'
      or not ((payload -> 'record') ?& array['eventDistanceM', 'bestSeconds'])
      or (payload -> 'record') - array['eventDistanceM', 'bestSeconds'] <> '{}'::jsonb
      or jsonb_typeof(payload #> '{record,eventDistanceM}') <> 'number'
      or jsonb_typeof(payload #> '{record,bestSeconds}') <> 'number'
      or (payload #>> '{record,eventDistanceM}')::numeric < 60
      or (payload #>> '{record,eventDistanceM}')::numeric <> trunc((payload #>> '{record,eventDistanceM}')::numeric)
      or (payload #>> '{record,bestSeconds}')::numeric <= 0
    then
      return false;
    end if;
  end if;

  if payload -> 'recent8WeekDistanceKm' <> 'null'::jsonb and (
    jsonb_typeof(payload -> 'recent8WeekDistanceKm') <> 'number'
    or (payload ->> 'recent8WeekDistanceKm')::numeric < 0
  ) then
    return false;
  end if;

  if payload -> 'structuredSessionCount' <> 'null'::jsonb and (
    jsonb_typeof(payload -> 'structuredSessionCount') <> 'number'
    or (payload ->> 'structuredSessionCount')::numeric < 0
    or (payload ->> 'structuredSessionCount')::numeric <> trunc((payload ->> 'structuredSessionCount')::numeric)
  ) then
    return false;
  end if;

  for item in select value from jsonb_array_elements(payload -> 'energySessionCounts') loop
    if jsonb_typeof(item) <> 'object'
      or not (item ?& array['key', 'count'])
      or item - array['key', 'count'] <> '{}'::jsonb
      or item ->> 'key' not in ('RECOVERY', 'BASE', 'LT', 'VO2', 'GLY', 'ATP_PC', 'MIXED_UNALLOCATED')
      or jsonb_typeof(item -> 'count') <> 'number'
      or (item ->> 'count')::numeric < 0
      or (item ->> 'count')::numeric <> trunc((item ->> 'count')::numeric)
    then
      return false;
    end if;
  end loop;

  select count(*), count(distinct value ->> 'key')
  into energy_key_count, unique_energy_key_count
  from jsonb_array_elements(payload -> 'energySessionCounts');
  if energy_key_count > 7 or energy_key_count <> unique_energy_key_count
    or ((payload -> 'sharedFields' ? 'ENERGY_HISTORY') and payload -> 'structuredSessionCount' = 'null'::jsonb)
    or (not (payload -> 'sharedFields' ? 'ENERGY_HISTORY') and energy_key_count <> 0)
  then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

create table if not exists public.public_oracle_comparison_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot_payload jsonb not null,
  is_enabled boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  check (public.oracle_comparison_snapshot_is_safe(snapshot_payload))
);

alter table public.public_oracle_comparison_snapshots enable row level security;

revoke all on table public.public_oracle_comparison_snapshots from public, anon, authenticated;
grant select on table public.public_oracle_comparison_snapshots to anon, authenticated;
grant insert, update, delete on table public.public_oracle_comparison_snapshots to authenticated;

create policy "public or own oracle comparison select" on public.public_oracle_comparison_snapshots
  for select using (
    auth.uid() = user_id
    or (
      is_enabled
      and public.public_profile_sharing_enabled()
      and exists (
        select 1
        from public.public_athlete_profiles profile
        where profile.user_id = public_oracle_comparison_snapshots.user_id
          and profile.is_public
      )
    )
  );

create policy "own oracle comparison insert" on public.public_oracle_comparison_snapshots
  for insert with check (
    auth.uid() = user_id
    and public.service_feature_enabled('PUBLIC_PROFILE')
    and public.account_network_access_allowed(user_id)
  );

create policy "own oracle comparison update" on public.public_oracle_comparison_snapshots
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.service_feature_enabled('PUBLIC_PROFILE')
    and public.account_network_access_allowed(user_id)
  );

create policy "own oracle comparison delete" on public.public_oracle_comparison_snapshots
  for delete using (auth.uid() = user_id);

drop trigger if exists public_oracle_comparison_feature_guard on public.public_oracle_comparison_snapshots;
create trigger public_oracle_comparison_feature_guard
before insert or update on public.public_oracle_comparison_snapshots
for each row execute function public.enforce_service_feature_write('PUBLIC_PROFILE');
