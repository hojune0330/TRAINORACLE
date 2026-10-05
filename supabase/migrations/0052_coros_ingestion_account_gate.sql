-- Provider authentication authorizes COROS to call this RPC, but it does not
-- authorize storage for a TrainOracle account that is no longer admitted.
-- Provider pushes do not carry an end-user JWT, so enforce the current 0051
-- account predicates directly for the linked user instead of calling the
-- caller-bound account_network_access_allowed(uuid) helper.
begin;

create or replace function public.ingest_coros_activity_batch(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  item jsonb;
  inserted_rows integer;
  connection_is_admitted boolean;
  accepted_count integer := 0;
  duplicate_count integer := 0;
  rejected_count integer := 0;
begin
  if public.service_feature_enabled('DEVICE_INTEGRATION') is distinct from true then
    raise exception using
      errcode = 'P0001',
      message = 'DEVICE_INTEGRATION_DISABLED';
  end if;

  if public.service_feature_enabled('ACCOUNT') is distinct from true then
    raise exception using
      errcode = 'P0001',
      message = 'ACCOUNT_DISABLED';
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

    -- Resolve admission and perform the insert in one statement. This keeps an
    -- active provider link from bypassing ACCOUNT, deletion, age, legal, or
    -- enrollment gates while preserving the service_role provider flow.
    with admitted_connection as materialized (
      select connection.id, connection.user_id
      from public.external_provider_connections connection
      join public.user_private_profiles profile
        on profile.user_id = connection.user_id
      join public.beta_enrollments enrollment
        on enrollment.user_id = connection.user_id
      where connection.provider = 'COROS'
        and connection.provider_user_id = item->>'providerUserId'
        and connection.connection_status = 'ACTIVE'
        and public.service_feature_enabled('ACCOUNT') is true
        and profile.birth_date <=
          (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'
        and profile.deletion_requested_at is null
        and profile.privacy_policy_version = '2026-08-26'
        and profile.terms_of_service_version = '2026-08-26'
        and profile.legal_consented_at is not null
        and profile.legal_consented_at <= clock_timestamp()
        and not exists (
          select 1
          from public.account_deletion_requests request
          where request.user_id = connection.user_id
        )
      limit 1
    ), inserted as (
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
      )
      select
        admitted_connection.user_id,
        admitted_connection.id,
        'COROS',
        item->>'providerRecordId',
        (item->>'activityStart')::timestamptz,
        item->>'sportCode',
        nullif(item->>'distanceMeters', '')::numeric,
        nullif(item->>'durationSeconds', '')::numeric,
        nullif(item->>'deviceName', ''),
        item->>'payloadDigest'
      from admitted_connection
      on conflict (connection_id, provider_record_id) do nothing
      returning 1
    )
    select
      exists (select 1 from admitted_connection),
      count(*)::integer
    into connection_is_admitted, inserted_rows
    from inserted;

    if not connection_is_admitted then
      rejected_count := rejected_count + 1;
    elsif inserted_rows = 1 then
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

revoke all on function public.ingest_coros_activity_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_coros_activity_batch(jsonb) to service_role;

comment on function public.ingest_coros_activity_batch(jsonb) is
  'Service-only COROS inbox ingestion gated by active provider link and current account admission.';

commit;
