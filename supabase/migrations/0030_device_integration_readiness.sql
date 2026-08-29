alter table public.service_feature_controls
  drop constraint if exists service_feature_controls_feature_key_check;
alter table public.service_feature_controls
  add constraint service_feature_controls_feature_key_check
  check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD',
    'PLAN_BACKUP', 'PUBLIC_PROFILE', 'DEVICE_INTEGRATION'
  ));

alter table public.service_feature_control_events
  drop constraint if exists service_feature_control_events_feature_key_check;
alter table public.service_feature_control_events
  add constraint service_feature_control_events_feature_key_check
  check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD',
    'PLAN_BACKUP', 'PUBLIC_PROFILE', 'DEVICE_INTEGRATION'
  ));

insert into public.service_feature_controls (feature_key, enabled, change_reason)
values ('DEVICE_INTEGRATION', false, 'APPLICATION_READINESS_FAIL_CLOSED')
on conflict (feature_key) do nothing;

create table if not exists public.external_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('GARMIN', 'COROS')),
  provider_user_id text not null,
  connection_status text not null default 'ACTIVE' check (
    connection_status in ('ACTIVE', 'REVOKED', 'ERROR')
  ),
  scopes text[] not null default '{}',
  consent_version text not null,
  linked_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  unique (user_id, provider),
  unique (provider, provider_user_id),
  check (length(provider_user_id) between 1 and 300),
  check (length(consent_version) between 1 and 80),
  check ((connection_status = 'REVOKED') = (revoked_at is not null))
);

create table if not exists public.external_activity_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.external_provider_connections (id) on delete cascade,
  provider text not null check (provider in ('GARMIN', 'COROS')),
  provider_record_id text not null,
  activity_start timestamptz not null,
  sport_code text not null,
  distance_meters numeric check (distance_meters is null or distance_meters >= 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  device_name text,
  payload_digest text not null,
  review_state text not null default 'PENDING_USER_CONFIRMATION' check (
    review_state in ('PENDING_USER_CONFIRMATION', 'CONFIRMED', 'DISMISSED')
  ),
  received_at timestamptz not null default clock_timestamp(),
  unique (connection_id, provider_record_id),
  check (length(provider_record_id) between 1 and 300),
  check (length(sport_code) between 1 and 100),
  check (device_name is null or length(device_name) <= 120),
  check (payload_digest ~ '^[a-f0-9]{64}$')
);

create index if not exists external_activity_inbox_pending_idx
  on public.external_activity_inbox (user_id, received_at desc)
  where review_state = 'PENDING_USER_CONFIRMATION';

alter table public.external_provider_connections enable row level security;
alter table public.external_activity_inbox enable row level security;

revoke all on table public.external_provider_connections from public, anon, authenticated;
revoke all on table public.external_activity_inbox from public, anon, authenticated;

create or replace function public.ingest_coros_activity_batch(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  matched_connection public.external_provider_connections%rowtype;
  inserted_rows integer;
  accepted_count integer := 0;
  duplicate_count integer := 0;
  rejected_count integer := 0;
begin
  if not public.service_feature_enabled('DEVICE_INTEGRATION') then
    raise exception using
      errcode = 'P0001',
      message = 'DEVICE_INTEGRATION_DISABLED';
  end if;

  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 50 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_ACTIVITY_BATCH';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(item->>'providerUserId', '') = ''
      or coalesce(item->>'providerRecordId', '') = ''
      or coalesce(item->>'activityStart', '') = ''
      or coalesce(item->>'sportCode', '') = ''
      or coalesce(item->>'payloadDigest', '') !~ '^[a-f0-9]{64}$' then
      rejected_count := rejected_count + 1;
      continue;
    end if;

    select * into matched_connection
    from public.external_provider_connections
    where provider = 'COROS'
      and provider_user_id = item->>'providerUserId'
      and connection_status = 'ACTIVE'
    limit 1;

    if not found then
      rejected_count := rejected_count + 1;
      continue;
    end if;

    insert into public.external_activity_inbox (
      user_id,
      connection_id,
      provider,
      provider_record_id,
      activity_start,
      sport_code,
      distance_meters,
      duration_seconds,
      device_name,
      payload_digest
    ) values (
      matched_connection.user_id,
      matched_connection.id,
      'COROS',
      item->>'providerRecordId',
      (item->>'activityStart')::timestamptz,
      item->>'sportCode',
      nullif(item->>'distanceMeters', '')::numeric,
      nullif(item->>'durationSeconds', '')::numeric,
      nullif(item->>'deviceName', ''),
      item->>'payloadDigest'
    )
    on conflict (connection_id, provider_record_id) do nothing;

    get diagnostics inserted_rows = row_count;
    if inserted_rows = 1 then
      accepted_count := accepted_count + 1;
    else
      duplicate_count := duplicate_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'accepted', accepted_count,
    'duplicates', duplicate_count,
    'rejected', rejected_count
  );
end;
$$;

revoke all on function public.ingest_coros_activity_batch(jsonb) from public;
revoke all on function public.ingest_coros_activity_batch(jsonb) from anon;
revoke all on function public.ingest_coros_activity_batch(jsonb) from authenticated;
grant execute on function public.ingest_coros_activity_batch(jsonb) to service_role;

comment on table public.external_provider_connections is
  'Application-readiness provider identity mapping. Provider tokens are intentionally absent.';
comment on table public.external_activity_inbox is
  'Bounded external activity facts pending explicit user confirmation; no raw provider payload.';
