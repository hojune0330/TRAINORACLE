-- COROS daily observations are quarantined ciphertext, not analysis inputs.
alter table public.external_provider_connections
  add column if not exists connection_epoch uuid not null default gen_random_uuid();
grant select on public.external_provider_connections to service_role;

create table public.external_daily_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.external_provider_connections(id) on delete cascade,
  connection_epoch uuid not null,
  provider_day date not null,
  content_digest text not null check (content_digest ~ '^[a-f0-9]{64}$'),
  encrypted_payload jsonb not null check (coalesce((
    jsonb_typeof(encrypted_payload) = 'object'
    and encrypted_payload->>'algorithm' = 'AES-GCM'
    and encrypted_payload->>'version' = '1'
    and length(encrypted_payload->>'keyId') between 1 and 80
    and length(encrypted_payload->>'iv') = 16
    and length(encrypted_payload->>'ciphertext') between 24 and 1398104
    and encrypted_payload ?& array['algorithm','version','keyId','iv','ciphertext']
    and (encrypted_payload - array['algorithm','version','keyId','iv','ciphertext']) = '{}'::jsonb
  ),false)),
  review_state text not null default 'PENDING_SOURCE_REVIEW' check (review_state = 'PENDING_SOURCE_REVIEW'),
  received_at timestamptz not null default clock_timestamp(),
  unique(connection_id, connection_epoch, provider_day, content_digest)
);
alter table public.external_daily_observations enable row level security;
revoke all on public.external_daily_observations from public, anon, authenticated;

create or replace function public.ingest_coros_daily_envelopes(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item jsonb;
  link public.external_provider_connections%rowtype;
  processed integer := 0;
  inserted integer := 0;
  affected integer;
begin
  if not public.service_feature_enabled('DEVICE_INTEGRATION') then raise exception 'DEVICE_INTEGRATION_DISABLED'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_DAILY_BATCH'; end if;
  if jsonb_array_length(p_items) not between 1 and 150 then
    raise exception 'INVALID_DAILY_BATCH';
  end if;
  -- All batches acquire connection locks in the same order, including mixed-user batches.
  for item in select value from jsonb_array_elements(p_items) order by value->>'connectionId', value->>'providerDay'
  loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'INVALID_DAILY_ENVELOPE'; end if;
    select * into link from public.external_provider_connections
      where id = (item->>'connectionId')::uuid for update;
    if not found or link.provider <> 'COROS' or link.connection_status <> 'ACTIVE'
      or link.user_id is distinct from (item->>'ownerId')::uuid
      or link.connection_epoch is distinct from (item->>'connectionEpoch')::uuid
      or ('DAILY_READ' = any(link.scopes)) is not true then raise exception 'DAILY_CONNECTION_UNAVAILABLE'; end if;
    if item->>'providerDay' is null or item->>'contentDigest' is null or item->'payload' is null then
      raise exception 'INVALID_DAILY_ENVELOPE';
    end if;
    insert into public.external_daily_observations
      (user_id,connection_id,connection_epoch,provider_day,content_digest,encrypted_payload)
    values (link.user_id,link.id,link.connection_epoch,(item->>'providerDay')::date,item->>'contentDigest',item->'payload')
    on conflict (connection_id,connection_epoch,provider_day,content_digest) do nothing;
    get diagnostics affected = row_count;
    inserted := inserted + affected;
    processed := processed + 1;
  end loop;
  return jsonb_build_object('committed',true,'processed',processed,'inserted',inserted,'duplicates',processed-inserted);
end;
$$;
revoke all on function public.ingest_coros_daily_envelopes(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_coros_daily_envelopes(jsonb) to service_role;

create or replace function public.disconnect_coros_connection()
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.external_provider_connections set connection_status='REVOKED',
    revoked_at=clock_timestamp(), connection_epoch=gen_random_uuid()
    where user_id=auth.uid() and provider='COROS' and connection_status <> 'REVOKED';
  return found;
end;
$$;
revoke all on function public.disconnect_coros_connection() from public,anon;
grant execute on function public.disconnect_coros_connection() to authenticated;

comment on table public.external_daily_observations is
  'Encrypted bounded COROS daily versions. A later receipt is not proof of a newer provider revision. No automatic analysis adoption.';
