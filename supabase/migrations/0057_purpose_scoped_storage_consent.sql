-- Explicit, purpose-separated sensitive storage consent. No feature is enabled.
-- Old legal acknowledgements and old sync preferences are not new consent.
begin;

-- A build flag is not operational evidence. This table starts empty and may
-- only be populated by a separately approved database-owner release operation
-- after actual vendor transfer/retention facts and notices have been reviewed.
create table public.account_storage_operation_reviews (
  purpose_version text primary key,
  evidence_reference text not null check (length(trim(evidence_reference)) between 12 and 500),
  reviewed_at timestamptz not null,
  approved boolean not null default false
);
alter table public.account_storage_operation_reviews enable row level security;
revoke all on public.account_storage_operation_reviews from public,anon,authenticated,service_role;

create function public.account_storage_operations_ready()
returns boolean language sql volatile security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.account_storage_operation_reviews
    where purpose_version='2026-10-05' and approved and reviewed_at <= clock_timestamp());
$$;
revoke all on function public.account_storage_operations_ready() from public,anon,authenticated,service_role;

create table public.account_storage_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision between 1 and 9007199254740990),
  purpose_version text not null,
  health_storage boolean not null default false,
  journal_text_storage boolean not null default false,
  decided_at timestamptz not null default clock_timestamp(),
  decided_session_id uuid not null
);
create table public.account_storage_consent_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  purpose_version text not null,
  health_storage boolean not null,
  journal_text_storage boolean not null,
  decided_at timestamptz not null,
  primary key(user_id, revision)
);
alter table public.account_storage_consents enable row level security;
alter table public.account_storage_consent_events enable row level security;
revoke all on public.account_storage_consents, public.account_storage_consent_events
  from public, anon, authenticated, service_role;

create or replace function public.account_admission_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select auth.uid() = target_user
    and public.current_jwt_auth_method_allowed() is true
    and public.service_feature_enabled('ACCOUNT') is true
    and exists (
      select 1
      from public.beta_enrollments enrollment
      join public.user_private_profiles profile on profile.user_id = enrollment.user_id
      where enrollment.user_id = target_user
        and profile.birth_date <= (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'
        and profile.deletion_requested_at is null
        and profile.privacy_policy_version = '2026-10-05'
        and profile.terms_of_service_version = '2026-10-05'
        and profile.legal_consented_at is not null
        and profile.legal_consented_at <= clock_timestamp()
    )
    and not exists (
      select 1
      from public.account_deletion_requests request
      where request.user_id = target_user
    );
$$;
revoke all on function public.account_admission_access_allowed(uuid) from public, anon, authenticated, service_role;

-- Internal owner-based predicate also covers provider ingestion without an end-user JWT.
create function public.account_storage_consented(target_user uuid)
returns boolean language sql volatile security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from public.account_storage_consents c
    where c.user_id = target_user and c.purpose_version = '2026-10-05'
      and c.health_storage and c.journal_text_storage
      and c.decided_at <= clock_timestamp()
  );
$$;
revoke all on function public.account_storage_consented(uuid) from public, anon, authenticated, service_role;

create or replace function public.account_storage_subject_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select target_user is not null
    and public.account_storage_operations_ready() is true
    and public.account_storage_consented(target_user) is true
    and public.service_feature_enabled('ACCOUNT') is true
    and exists (
      select 1
      from public.beta_enrollments enrollment
      join public.user_private_profiles profile on profile.user_id = enrollment.user_id
      where enrollment.user_id = target_user
        and profile.birth_date <= (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'
        and profile.deletion_requested_at is null
        and profile.privacy_policy_version = '2026-10-05'
        and profile.terms_of_service_version = '2026-10-05'
        and profile.legal_consented_at is not null
        and profile.legal_consented_at <= clock_timestamp()
    )
    and not exists (
      select 1
      from public.account_deletion_requests request
      where request.user_id = target_user
    );
$$;
revoke all on function public.account_storage_subject_allowed(uuid) from public,anon,authenticated,service_role;

create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean language sql volatile security definer set search_path = pg_catalog as $$
  select public.account_admission_access_allowed(target_user)
    and public.account_storage_subject_allowed(target_user);
$$;

create or replace function public.get_current_account_admission_status(expected_user_id_input uuid)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  profile public.user_private_profiles%rowtype;
  now_at timestamptz := clock_timestamp();
  service_date date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);

  if actor is null or auth.jwt() ->> 'role' is distinct from 'authenticated' then
    return 'LOGIN_REQUIRED';
  end if;
  if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
  end if;
  if expected_user_id_input is null or actor is distinct from expected_user_id_input then
    return 'IDENTITY_MISMATCH';
  end if;
  if public.service_feature_enabled('ACCOUNT') is distinct from true then
    return 'ACCOUNT_DISABLED';
  end if;
  if exists (
    select 1 from public.account_deletion_requests request
    where request.user_id = actor
  ) then
    return 'DELETION_REQUESTED';
  end if;

  select candidate.* into profile
  from public.user_private_profiles candidate
  where candidate.user_id = actor;
  if not found then
    return 'NEEDS_PROFILE';
  end if;
  if profile.deletion_requested_at is not null then
    return 'DELETION_REQUESTED';
  end if;
  if profile.birth_date > service_date - interval '14 years' then
    return 'UNDER_14';
  end if;
  if profile.privacy_policy_version is distinct from '2026-10-05'
    or profile.terms_of_service_version is distinct from '2026-10-05'
    or profile.legal_consented_at is null
    or profile.legal_consented_at > now_at then
    return 'LEGAL_RECONSENT_REQUIRED';
  end if;
  if not exists (
    select 1 from public.beta_enrollments enrollment
    where enrollment.user_id = actor
  ) then
    return 'BETA_NOT_ENROLLED';
  end if;
  if public.account_admission_access_allowed(actor) is distinct from true then
    return 'RESTRICTED';
  end if;
  return 'ADMITTED';
end;
$$;



create or replace function public.account_subject_public_data_allowed(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select target_user is not null
    and public.account_storage_subject_allowed(target_user)
    and public.service_feature_enabled('ACCOUNT') is true
    and public.public_profile_sharing_enabled() is true
    and exists (
      select 1
      from public.public_athlete_profiles public_profile
      where public_profile.user_id = target_user
        and public_profile.is_public
    )
    and exists (
      select 1
      from public.beta_enrollments enrollment
      join public.user_private_profiles profile on profile.user_id = enrollment.user_id
      where enrollment.user_id = target_user
        and profile.birth_date <= (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'
        and profile.deletion_requested_at is null
        and profile.privacy_policy_version = '2026-10-05'
        and profile.terms_of_service_version = '2026-10-05'
        and profile.legal_consented_at is not null
        and profile.legal_consented_at <= clock_timestamp()
    )
    and not exists (
      select 1
      from public.account_deletion_requests request
      where request.user_id = target_user
    );
$$;

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
        and public.account_storage_subject_allowed(connection.user_id)
        and public.service_feature_enabled('ACCOUNT') is true
        and profile.birth_date <=
          (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'
        and profile.deletion_requested_at is null
        and profile.privacy_policy_version = '2026-10-05'
        and profile.terms_of_service_version = '2026-10-05'
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

create function public.get_account_storage_consent(expected_user_id_input uuid)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare actor uuid := auth.uid(); c public.account_storage_consents%rowtype;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if actor is null or actor is distinct from expected_user_id_input
    or public.current_jwt_session_active() is distinct from true then
    raise exception 'STORAGE_CONSENT_IDENTITY_REQUIRED' using errcode='42501';
  end if;
  select * into c from public.account_storage_consents where user_id=actor;
  return jsonb_build_object('userId',actor,'revision',coalesce(c.revision,0),
    'purposeVersion','2026-10-05',
    'healthStorage',coalesce(c.purpose_version='2026-10-05' and c.health_storage,false),
    'journalTextStorage',coalesce(c.purpose_version='2026-10-05' and c.journal_text_storage,false),
    'decidedAt',c.decided_at,'operationsReady',public.account_storage_operations_ready());
end;
$$;

create function public.set_account_storage_consent(
  expected_user_id_input uuid, expected_session_id_input uuid,
  expected_revision_input bigint, purpose_version_input text,
  health_storage_input boolean, journal_text_storage_input boolean
)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare actor uuid := auth.uid(); actual_revision bigint; decided timestamptz := clock_timestamp();
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if actor is null or actor is distinct from expected_user_id_input
    or public.current_jwt_session_active() is distinct from true
    or expected_session_id_input is null
    or expected_session_id_input::text is distinct from auth.jwt()->>'session_id' then
    raise exception 'STORAGE_CONSENT_IDENTITY_REQUIRED' using errcode='42501';
  end if;
  if purpose_version_input is distinct from '2026-10-05'
    or expected_revision_input is null or expected_revision_input < 0
    or expected_revision_input >= 9007199254740990
    or health_storage_input is null or journal_text_storage_input is null then
    raise exception 'STORAGE_CONSENT_VERSION_REQUIRED' using errcode='22023';
  end if;
  -- Admission/readiness checks must run after serializing with deletion and
  -- writes, not from a snapshot taken before waiting for the account lock.
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || actor::text,0));
  if public.current_jwt_session_active() is distinct from true then
    raise exception 'STORAGE_CONSENT_IDENTITY_REQUIRED' using errcode='42501';
  end if;
  -- Withdrawing both purposes remains reachable after a legal update or kill switch.
  if (health_storage_input or journal_text_storage_input)
    and public.account_admission_access_allowed(actor) is distinct from true then
    raise exception 'STORAGE_CONSENT_ADMISSION_REQUIRED' using errcode='42501';
  end if;
  if (health_storage_input or journal_text_storage_input)
    and public.account_storage_operations_ready() is distinct from true then
    raise exception 'STORAGE_OPERATIONS_REVIEW_REQUIRED' using errcode='42501';
  end if;
  -- Same lock as journal mutations: after withdrawal succeeds, in-flight writers
  -- cannot commit on an earlier consent snapshot. No stored records are deleted here.
  select revision into actual_revision from public.account_storage_consents where user_id=actor for update;
  if coalesce(actual_revision,0) <> expected_revision_input then
    raise exception 'STORAGE_CONSENT_CHANGED' using errcode='40001';
  end if;
  insert into public.account_storage_consents
    (user_id,revision,purpose_version,health_storage,journal_text_storage,decided_at,decided_session_id)
  values(actor,expected_revision_input+1,purpose_version_input,health_storage_input,journal_text_storage_input,decided,expected_session_id_input)
  on conflict(user_id) do update set revision=excluded.revision,purpose_version=excluded.purpose_version,
    health_storage=excluded.health_storage,journal_text_storage=excluded.journal_text_storage,
    decided_at=excluded.decided_at,decided_session_id=excluded.decided_session_id;
  insert into public.account_storage_consent_events values
    (actor,expected_revision_input+1,purpose_version_input,health_storage_input,journal_text_storage_input,decided);
  return public.get_account_storage_consent(actor);
end;
$$;
revoke all on function public.get_account_storage_consent(uuid),
  public.set_account_storage_consent(uuid,uuid,bigint,text,boolean,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.get_account_storage_consent(uuid),
  public.set_account_storage_consent(uuid,uuid,bigint,text,boolean,boolean) to authenticated;

-- Security-definer RPCs and provider jobs do not all use RLS. Check at the final
-- storage boundary too. DELETE/retention is deliberately not conditional on consent.
create or replace function public.enforce_current_account_legal_versions()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.privacy_policy_version is null and new.terms_of_service_version is null then return new; end if;
  if new.privacy_policy_version is distinct from '2026-10-05'
    or new.terms_of_service_version is distinct from '2026-10-05' then
    raise exception 'invalid legal consent version' using errcode='22023';
  end if;
  return new;
end;
$$;

create function public.enforce_account_storage_consent()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := (to_jsonb(new)->>tg_argv[0])::uuid;
begin
  if tg_op='UPDATE' and (to_jsonb(old)->>tg_argv[0])::uuid is distinct from owner_id then
    raise exception 'STORAGE_OWNER_IMMUTABLE' using errcode='42501';
  end if;
  -- Retention may erase an operation payload after withdrawal, but may not
  -- change any other field or replace the payload with new health content.
  if tg_table_name='account_journal_operations' and tg_op='UPDATE'
    and to_jsonb(new)->'proposed_encrypted_payload' = 'null'::jsonb
    and (to_jsonb(new)-'proposed_encrypted_payload') = (to_jsonb(old)-'proposed_encrypted_payload') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  if public.account_storage_operations_ready() is distinct from true then
    raise exception 'STORAGE_OPERATIONS_REVIEW_REQUIRED' using errcode='42501';
  end if;
  if public.account_storage_subject_allowed(owner_id) is distinct from true then
    raise exception 'STORAGE_CONSENT_REQUIRED' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_account_storage_consent() from public,anon,authenticated,service_role;

do $$
declare item text; owner_column text;
begin
  foreach item in array array[
    'journal_entries','encrypted_private_notes','saved_training_plans',
    'account_journal_documents','account_journal_operations','account_journal_history',
    'account_plan_collection_parts','account_plan_collection_indexes','account_plan_collection_receipts',
    'account_plan_collection_staging','external_activity_inbox','external_daily_observations',
    'public_plan_share_cards','public_oracle_comparison_snapshots',
    'plan_proposals','plan_safety_snapshots','plan_versions','athlete_active_plans'
  ] loop
    owner_column := case when item in ('plan_proposals','plan_safety_snapshots','plan_versions','athlete_active_plans')
      then 'athlete_id' else 'user_id' end;
    execute format('create trigger require_storage_consent before insert or update on public.%I
      for each row execute function public.enforce_account_storage_consent(%L)',item,owner_column);
  end loop;
end;
$$;

comment on table public.account_storage_consents is
  'Separate optional health and journal-text account storage decisions. Never inferred from signup. Withdrawal stops online processing; deletion is a separate request. No raw content.';

-- Explicit data-subject access is not automatic restoration or renewed
-- consent. This read-only endpoint remains available after withdrawal, legal
-- version changes, operational kill switches and an unprocessed deletion request.
create function public.account_data_rights_identity(expected_user_id_input uuid, expected_session_id_input uuid)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if auth.uid() is null or auth.uid() is distinct from expected_user_id_input
    or public.current_jwt_session_active() is distinct from true
    or expected_session_id_input is null
    or expected_session_id_input::text is distinct from auth.jwt()->>'session_id'
    or not exists(select 1 from auth.users u where u.id=auth.uid()
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())) then
    raise exception 'DATA_RIGHTS_IDENTITY_REQUIRED' using errcode='42501';
  end if;
  return true;
end;
$$;
create function public.read_account_data_rights_page(
  expected_user_id_input uuid, expected_session_id_input uuid,
  collection_input text, cursor_input text default ''
)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare table_name text; key_expression text; predicate text := ''; rows_json jsonb;
begin
  perform public.account_data_rights_identity(expected_user_id_input,expected_session_id_input);
  if cursor_input is null or length(cursor_input)>1200 then
    raise exception 'INVALID_DATA_RIGHTS_CURSOR' using errcode='22023';
  end if;
  -- Identifiers and predicates are fixed server strings, never caller SQL.
  case collection_input
    when 'journal' then table_name:='account_journal_documents'; key_expression:='document_id::text';
    when 'history' then table_name:='account_journal_history'; key_expression:='document_id::text || '':'' || lpad(revision::text,16,''0'')';
      predicate:=' and expires_at > clock_timestamp()';
    when 'planParts' then table_name:='account_plan_collection_parts'; key_expression:='part_kind || '':'' || part_id';
    when 'planIndex' then table_name:='account_plan_collection_indexes'; key_expression:='user_id::text';
    when 'legacyJournal' then table_name:='journal_entries'; key_expression:='entry_id';
    when 'legacyPlans' then table_name:='saved_training_plans'; key_expression:='plan_id';
    when 'legacyPrivateNotes' then table_name:='encrypted_private_notes'; key_expression:='entry_id';
    when 'providerActivities' then table_name:='external_activity_inbox'; key_expression:='id::text';
    when 'providerDaily' then table_name:='external_daily_observations'; key_expression:='id::text';
    else raise exception 'INVALID_DATA_RIGHTS_COLLECTION' using errcode='22023';
  end case;
  execute format('select coalesce(jsonb_agg(jsonb_build_object(''cursor'',q.row_key,''record'',q.record) order by q.row_key),''[]''::jsonb)
    from (select %s as row_key,to_jsonb(t) as record from public.%I t
    where user_id=$1 and (%s)>$2 %s order by (%s) limit 10) q',
    key_expression,table_name,key_expression,predicate,key_expression)
    into rows_json using expected_user_id_input,cursor_input;
  return jsonb_build_object('ownerId',expected_user_id_input,'collection',collection_input,'items',rows_json,
    'nextCursor',case when jsonb_array_length(rows_json)=10 then rows_json->9->>'cursor' else null end);
end;
$$;
revoke all on function public.account_data_rights_identity(uuid,uuid),
  public.read_account_data_rights_page(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.account_data_rights_identity(uuid,uuid),
  public.read_account_data_rights_page(uuid,uuid,text,text) to authenticated;
create or replace function public.claim_beta_seat(
  expected_user_id_input uuid,
  expected_session_id_input uuid,
  birth_date_input date,
  privacy_policy_version_input text,
  terms_of_service_version_input text
)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  current_session_id uuid;
  capacity_limit integer;
  occupied_seats integer;
  consent_time timestamptz := clock_timestamp();
  service_date date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  existing_birth_date date;
  existing_deletion_requested_at timestamptz;
  profile_exists boolean := false;
  already_enrolled boolean := false;
  affected_rows integer := 0;
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);

  if actor is null or auth.jwt() ->> 'role' is distinct from 'authenticated' then
    return 'LOGIN_REQUIRED';
  end if;
  if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
  end if;
  if expected_user_id_input is null or actor is distinct from expected_user_id_input then
    return 'IDENTITY_MISMATCH';
  end if;

  begin
    current_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception
    when others then
      return 'SESSION_MISMATCH';
  end;
  if expected_session_id_input is null
    or current_session_id is distinct from expected_session_id_input then
    return 'SESSION_MISMATCH';
  end if;

  if public.service_feature_enabled('ACCOUNT') is distinct from true then
    return 'ACCOUNT_FEATURE_DISABLED';
  end if;
  if birth_date_input is null or birth_date_input > service_date then
    return 'INVALID_BIRTH_DATE';
  end if;
  if birth_date_input > service_date - interval '14 years' then
    return 'UNDER_14_NOT_ELIGIBLE';
  end if;
  if privacy_policy_version_input is distinct from '2026-10-05'
    or terms_of_service_version_input is distinct from '2026-10-05' then
    return 'LEGAL_VERSION_INVALID';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests request
    where request.user_id = actor
  ) then
    return 'ACCOUNT_BLOCKED';
  end if;

  select capacity.seat_limit
  into capacity_limit
  from public.beta_capacity_controls capacity
  where capacity.capacity_key = 'PUBLIC_BETA'
  for update;

  if capacity_limit is null then
    return 'CAPACITY_NOT_CONFIGURED';
  end if;

  select profile.birth_date, profile.deletion_requested_at
  into existing_birth_date, existing_deletion_requested_at
  from public.user_private_profiles profile
  where profile.user_id = actor
  for update;
  profile_exists := found;

  if profile_exists and existing_deletion_requested_at is not null then
    return 'ACCOUNT_BLOCKED';
  end if;
  if profile_exists and existing_birth_date is distinct from birth_date_input then
    return 'BIRTH_DATE_MISMATCH';
  end if;

  select exists (
    select 1
    from public.beta_enrollments enrollment
    where enrollment.user_id = actor
  ) into already_enrolled;

  if already_enrolled then
    if not profile_exists then
      return 'PROFILE_INCONSISTENT';
    end if;
    update public.user_private_profiles
    set privacy_policy_version = privacy_policy_version_input,
        terms_of_service_version = terms_of_service_version_input,
        legal_consented_at = consent_time,
        updated_at = consent_time
    where user_id = actor
      and birth_date = birth_date_input
      and deletion_requested_at is null;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      return 'ACCOUNT_BLOCKED';
    end if;
    return 'ADMITTED_EXISTING';
  end if;

  select count(*)
  into occupied_seats
  from public.beta_enrollments;

  if occupied_seats >= capacity_limit then
    return 'BETA_FULL';
  end if;

  insert into public.beta_enrollments (user_id)
  values (actor);

  if profile_exists then
    update public.user_private_profiles
    set privacy_policy_version = privacy_policy_version_input,
        terms_of_service_version = terms_of_service_version_input,
        legal_consented_at = consent_time,
        updated_at = consent_time
    where user_id = actor
      and birth_date = birth_date_input
      and deletion_requested_at is null;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'profile changed during admission' using errcode = '40001';
    end if;
  else
    insert into public.user_private_profiles (
      user_id,
      birth_date,
      privacy_policy_version,
      terms_of_service_version,
      legal_consented_at,
      updated_at
    ) values (
      actor,
      birth_date_input,
      privacy_policy_version_input,
      terms_of_service_version_input,
      consent_time,
      consent_time
    );
  end if;

  return 'ADMITTED_NEW';
end;
$$;
create or replace function public.request_account_deletion(expected_user_id_input uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  requested timestamptz := clock_timestamp();
  recorded timestamptz;
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);
  if public.current_jwt_session_active() is distinct from true then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if expected_user_id_input is null or actor is distinct from expected_user_id_input then
    raise exception 'authenticated user mismatch' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || actor::text,0));
  if public.current_jwt_session_active() is distinct from true then
    raise exception 'authentication required' using errcode='42501';
  end if;

  insert into public.account_deletion_requests (
    user_id,
    requested_at,
    access_blocked_at,
    delete_by,
    status
  ) values (
    actor,
    requested,
    requested,
    requested + interval '30 days',
    'REQUESTED'
  )
  on conflict (user_id) do nothing;

  -- A deletion request is also a withdrawal, committed under the same lock.
  -- Repeated deletion calls preserve the original request and do not mint consent.
  with withdrawn as (
    update public.account_storage_consents set revision=revision+1,
      purpose_version='2026-10-05',health_storage=false,journal_text_storage=false,
      decided_at=requested,decided_session_id=(auth.jwt()->>'session_id')::uuid
    where user_id=actor and (health_storage or journal_text_storage)
    returning user_id,revision,purpose_version,health_storage,journal_text_storage,decided_at
  )
  insert into public.account_storage_consent_events
    (user_id,revision,purpose_version,health_storage,journal_text_storage,decided_at)
  select user_id,revision,purpose_version,health_storage,journal_text_storage,decided_at from withdrawn;

  select request.requested_at into recorded
  from public.account_deletion_requests request
  where request.user_id = actor;
  return recorded;
end;
$$;
commit;
