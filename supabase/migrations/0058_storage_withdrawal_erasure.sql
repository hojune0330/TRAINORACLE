-- Additive repair: purpose withdrawal erases live purpose data atomically.
-- No operational approval, backup completion or deployment is implied.
begin;

create table public.account_storage_erasure_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_revision bigint not null,
  requested_at timestamptz not null default clock_timestamp(),
  live_erased_at timestamptz,
  backup_status text not null default 'PENDING' check (backup_status in ('PENDING','VERIFIED')),
  primary key(user_id,consent_revision)
);
-- Short-lived authorization, never a caller-controlled GUC. It exists only
-- inside the same transaction that records withdrawal and performs the erase.
create table public.account_storage_erasure_context (
  backend_pid integer not null,
  transaction_id bigint not null,
  user_id uuid not null,
  consent_revision bigint not null,
  primary key(backend_pid,transaction_id,user_id),
  foreign key(user_id,consent_revision)
    references public.account_storage_erasure_receipts(user_id,consent_revision)
);
alter table public.account_storage_erasure_receipts enable row level security;
alter table public.account_storage_erasure_context enable row level security;
revoke all on public.account_storage_erasure_receipts,public.account_storage_erasure_context
  from public,anon,authenticated,service_role;

create function public.account_storage_erasure_authorized(target_user uuid)
returns boolean language sql volatile security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.account_storage_erasure_context x
    join public.account_storage_erasure_receipts r using(user_id,consent_revision)
    join public.account_storage_consents c on c.user_id=x.user_id and c.revision=x.consent_revision
    where x.backend_pid=pg_backend_pid() and x.transaction_id=txid_current()
      and x.user_id=target_user and not(c.health_storage and c.journal_text_storage)
      and r.live_erased_at is null);
$$;
revoke all on function public.account_storage_erasure_authorized(uuid) from public,anon,authenticated,service_role;

create or replace function public.guard_legacy_account_journal_write()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare owner_id uuid;
begin
  if tg_op='DELETE' then owner_id:=old.user_id; else owner_id:=new.user_id; end if;
  if tg_op='DELETE' and public.account_storage_erasure_authorized(owner_id) then return old; end if;
  if auth.uid() is not null and exists(select 1 from auth.users u where u.id=owner_id)
    and (public.service_feature_enabled('ACCOUNT_JOURNAL_V2')
      or exists(select 1 from public.account_journal_cutovers c where c.user_id=owner_id)) then
    raise exception 'ACCOUNT_JOURNAL_LEGACY_WRITE_DENIED' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_legacy_account_journal_write() from public,anon,authenticated,service_role;

create or replace function public.enforce_service_feature_write()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare required_feature text:=tg_argv[0]; owner_id uuid;
begin
  if tg_op='DELETE' and tg_table_name in ('journal_entries','encrypted_private_notes','saved_training_plans',
    'public_plan_share_cards','public_oracle_comparison_snapshots','external_activity_inbox','external_daily_observations',
    'plan_proposals','plan_safety_snapshots','plan_versions','athlete_active_plans','plan_activation_receipts') then
    owner_id:=coalesce(to_jsonb(old)->>'user_id',to_jsonb(old)->>'athlete_id')::uuid;
    if public.account_storage_erasure_authorized(owner_id) then return old; end if;
  end if;
  if coalesce(auth.jwt()->>'role','')<>'service_role' and auth.uid() is not null then
    if required_feature<>'ACCOUNT' and not public.service_feature_enabled('ACCOUNT') then
      raise exception 'account feature disabled' using errcode='42501';
    end if;
    if not public.service_feature_enabled(required_feature) then
      raise exception using errcode='42501',message='SERVER_FEATURE_DISABLED_' || required_feature;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.enforce_service_feature_write() from public,anon,authenticated,service_role;

create or replace function public.reject_plan_version_mutation()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if tg_op='DELETE' and public.account_storage_erasure_authorized(old.athlete_id) then return old; end if;
  -- Existing service-only account-retention worker remains supported. This is
  -- not the authorization used by the new end-user withdrawal path.
  if tg_op='DELETE' and current_setting('trainoracle.retention_cleanup',true)='AUTHORIZED'
    and coalesce(auth.jwt()->>'role','')='service_role' then return old; end if;
  raise exception 'IMMUTABLE_PLAN_VERSION' using errcode='P0001';
end;
$$;
revoke all on function public.reject_plan_version_mutation() from public,anon,authenticated,service_role;

create function public.erase_withdrawn_account_storage(target_user uuid, target_revision bigint)
returns void language plpgsql volatile security definer set search_path=pg_catalog as $$
declare item text; owner_column text;
begin
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || target_user::text,0));
  if not exists(select 1 from public.account_storage_consents c where c.user_id=target_user
    and c.revision=target_revision and not(c.health_storage and c.journal_text_storage)) then
    raise exception 'STORAGE_WITHDRAWAL_REQUIRED' using errcode='42501';
  end if;
  insert into public.account_storage_erasure_receipts(user_id,consent_revision)
    values(target_user,target_revision) on conflict do nothing;
  if exists(select 1 from public.account_storage_erasure_receipts where user_id=target_user
    and consent_revision=target_revision and live_erased_at is not null) then return; end if;
  insert into public.account_storage_erasure_context values(pg_backend_pid(),txid_current(),target_user,target_revision);
  -- Mixed encrypted documents cannot be split into independently consented fields.
  -- Remove indexes first so the legacy-plan downgrade guard does not block erasure.
  foreach item in array array[
    'account_plan_collection_staging','account_plan_collection_receipts','account_plan_collection_indexes',
    'account_plan_collection_parts','account_journal_operations','account_journal_history','account_journal_documents',
    'journal_entries','encrypted_private_notes','saved_training_plans',
    'external_daily_observations','external_activity_inbox','public_plan_share_cards','public_oracle_comparison_snapshots',
    'athlete_active_plans','plan_versions','plan_proposals','plan_safety_snapshots',
    'account_journal_identity','account_journal_finalization_events'
  ] loop
    owner_column := case when item in ('plan_proposals','plan_safety_snapshots','plan_versions','athlete_active_plans')
      then 'athlete_id' else 'user_id' end;
    execute format('delete from public.%I where %I=$1',item,owner_column) using target_user;
  end loop;
  -- The provider connection generation is invalidated too: a delayed encrypted
  -- delivery cannot survive withdrawal followed by an explicit new connection.
  update public.external_provider_connections set connection_status='REVOKED',
    revoked_at=clock_timestamp(),connection_epoch=gen_random_uuid()
    where user_id=target_user and connection_status<>'REVOKED';
  update public.account_storage_erasure_receipts set live_erased_at=clock_timestamp()
    where user_id=target_user and consent_revision=target_revision;
  delete from public.account_storage_erasure_context where backend_pid=pg_backend_pid()
    and transaction_id=txid_current() and user_id=target_user;
end;
$$;
revoke all on function public.erase_withdrawn_account_storage(uuid,bigint) from public,anon,authenticated,service_role;

create function public.erase_account_storage_on_withdrawal()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if not(new.health_storage and new.journal_text_storage) then
    perform public.erase_withdrawn_account_storage(new.user_id,new.revision);
  end if;
  return new;
end;
$$;
revoke all on function public.erase_account_storage_on_withdrawal() from public,anon,authenticated,service_role;
create trigger erase_account_storage_on_withdrawal after insert or update on public.account_storage_consents
  for each row execute function public.erase_account_storage_on_withdrawal();

-- Every deletion request, including an account with no 0057 receipt, withdraws
-- both purposes under the same lock. The remainder is eligible for cleanup now,
-- not a blanket 30-day grace period or a promise that backups have been erased.
do $$ declare c record; begin
  for c in select conrelid::regclass as relation,conname from pg_constraint
    where conrelid in ('public.account_deletion_requests'::regclass,'public.user_private_profiles'::regclass)
      and contype='c' and pg_get_constraintdef(oid) like '%delete_by%' loop
    execute format('alter table %s drop constraint %I',c.relation,c.conname);
  end loop;
end $$;
alter table public.account_deletion_requests alter column delete_by set default clock_timestamp();
alter table public.account_deletion_requests add constraint account_deletion_due_order check(delete_by>=requested_at);
alter table public.user_private_profiles add constraint profile_deletion_due_order check(
  (deletion_requested_at is null and delete_by is null)
  or (deletion_requested_at is not null and delete_by>=deletion_requested_at));
create function public.withdraw_storage_on_account_deletion()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare c public.account_storage_consents%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || new.user_id::text,0));
  if exists(select 1 from public.account_deletion_requests where user_id=new.user_id) then return new; end if;
  new.delete_by := new.requested_at;
  insert into public.account_storage_consents(user_id,revision,purpose_version,health_storage,journal_text_storage,decided_at,decided_session_id)
    values(new.user_id,1,'2026-10-05',false,false,clock_timestamp(),(auth.jwt()->>'session_id')::uuid)
    on conflict(user_id) do update set revision=public.account_storage_consents.revision+1,
      health_storage=false,journal_text_storage=false,decided_at=excluded.decided_at,
      decided_session_id=excluded.decided_session_id
    returning * into c;
  insert into public.account_storage_consent_events values(c.user_id,c.revision,c.purpose_version,false,false,c.decided_at);
  return new;
end;
$$;
revoke all on function public.withdraw_storage_on_account_deletion() from public,anon,authenticated,service_role;
create trigger withdraw_storage_on_account_deletion before insert on public.account_deletion_requests
  for each row execute function public.withdraw_storage_on_account_deletion();

-- A legal-version update must not block deletion of an older admitted account.
create or replace function public.enforce_current_account_legal_versions()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='UPDATE' and (to_jsonb(new)-array['deletion_requested_at','delete_by','updated_at'])
    =(to_jsonb(old)-array['deletion_requested_at','delete_by','updated_at']) then return new; end if;
  if new.privacy_policy_version is null and new.terms_of_service_version is null then return new; end if;
  if new.privacy_policy_version is distinct from '2026-10-05' or new.terms_of_service_version is distinct from '2026-10-05' then
    raise exception 'invalid legal consent version' using errcode='22023';
  end if;
  return new;
end;
$$;

-- Lock owners before provider rows, consistently with withdrawal. Recheck the
-- immutable connection epoch after acquiring both locks; old jobs never relink.
create or replace function public.ingest_coros_daily_envelopes(p_items jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare item jsonb; link public.external_provider_connections%rowtype; owner_id uuid;
  processed integer:=0; inserted integer:=0; affected integer;
begin
  if not public.service_feature_enabled('DEVICE_INTEGRATION') then raise exception 'DEVICE_INTEGRATION_DISABLED'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_DAILY_BATCH'; end if;
  if jsonb_array_length(p_items) not between 1 and 150 then raise exception 'INVALID_DAILY_BATCH'; end if;
  for owner_id in select distinct c.user_id from public.external_provider_connections c
    join jsonb_array_elements(p_items) i on c.id=(i.value->>'connectionId')::uuid order by c.user_id loop
    perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  end loop;
  for item in select value from jsonb_array_elements(p_items) order by value->>'connectionId',value->>'providerDay' loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'INVALID_DAILY_ENVELOPE'; end if;
    select * into link from public.external_provider_connections where id=(item->>'connectionId')::uuid for update;
    if not found or link.provider<>'COROS' or link.connection_status<>'ACTIVE'
      or link.user_id is distinct from (item->>'ownerId')::uuid
      or link.connection_epoch is distinct from (item->>'connectionEpoch')::uuid
      or ('DAILY_READ'=any(link.scopes)) is not true then raise exception 'DAILY_CONNECTION_UNAVAILABLE'; end if;
    if item->>'providerDay' is null or item->>'contentDigest' is null or item->'payload' is null then raise exception 'INVALID_DAILY_ENVELOPE'; end if;
    insert into public.external_daily_observations(user_id,connection_id,connection_epoch,provider_day,content_digest,encrypted_payload)
      values(link.user_id,link.id,link.connection_epoch,(item->>'providerDay')::date,item->>'contentDigest',item->'payload')
      on conflict(connection_id,connection_epoch,provider_day,content_digest) do nothing;
    get diagnostics affected=row_count;
    inserted:=inserted+affected; processed:=processed+1;
  end loop;
  return jsonb_build_object('committed',true,'processed',processed,'inserted',inserted,'duplicates',processed-inserted);
end;
$$;
revoke all on function public.ingest_coros_daily_envelopes(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_coros_daily_envelopes(jsonb) to service_role;

-- No old request may become a new consented write after withdrawal/regrant.
-- Existing historical rows are not assigned a fabricated generation. Every new
-- workout, including direct service writes, must carry its observed epoch.
alter table public.external_activity_inbox add column connection_epoch uuid;
create or replace function public.ingest_coros_activity_batch(p_items jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare item jsonb; link public.external_provider_connections%rowtype; owner_id uuid;
  affected integer; accepted_count integer:=0; duplicate_count integer:=0; rejected_count integer:=0;
begin
  if public.service_feature_enabled('DEVICE_INTEGRATION') is distinct from true then raise exception 'DEVICE_INTEGRATION_DISABLED'; end if;
  if public.service_feature_enabled('ACCOUNT') is distinct from true then raise exception 'ACCOUNT_DISABLED'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_ACTIVITY_BATCH' using errcode='22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'INVALID_ACTIVITY_BATCH' using errcode='22023'; end if;
  for owner_id in select distinct c.user_id from public.external_provider_connections c
    join jsonb_array_elements(p_items) i on c.id=(i.value->>'connectionId')::uuid order by c.user_id loop
    perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  end loop;
  for item in select value from jsonb_array_elements(p_items) order by value->>'connectionId',value->>'providerRecordId' loop
    if coalesce(item->>'providerUserId','')='' or coalesce(item->>'providerRecordId','')=''
      or coalesce(item->>'activityStart','')='' or coalesce(item->>'sportCode','')=''
      or coalesce(item->>'payloadDigest','') !~ '^[a-f0-9]{64}$' then
      rejected_count:=rejected_count+1; continue;
    end if;
    select * into link from public.external_provider_connections where id=(item->>'connectionId')::uuid for update;
    if not found or link.provider<>'COROS' or link.connection_status<>'ACTIVE'
      or link.provider_user_id is distinct from item->>'providerUserId'
      or link.user_id is distinct from (item->>'ownerId')::uuid
      or link.connection_epoch is distinct from (item->>'connectionEpoch')::uuid
      or public.account_storage_subject_allowed(link.user_id) is distinct from true then
      rejected_count:=rejected_count+1; continue;
    end if;
    insert into public.external_activity_inbox(user_id,connection_id,connection_epoch,provider,provider_record_id,
      activity_start,sport_code,distance_meters,duration_seconds,device_name,payload_digest)
      values(link.user_id,link.id,(item->>'connectionEpoch')::uuid,'COROS',item->>'providerRecordId',
        (item->>'activityStart')::timestamptz,item->>'sportCode',nullif(item->>'distanceMeters','')::numeric,
        nullif(item->>'durationSeconds','')::numeric,nullif(item->>'deviceName',''),item->>'payloadDigest')
      on conflict(connection_id,provider_record_id) do nothing;
    get diagnostics affected=row_count;
    if affected=1 then accepted_count:=accepted_count+1; else duplicate_count:=duplicate_count+1; end if;
  end loop;
  return jsonb_build_object('accepted',accepted_count,'duplicates',duplicate_count,'rejected',rejected_count);
end;
$$;
revoke all on function public.ingest_coros_activity_batch(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_coros_activity_batch(jsonb) to service_role;

-- Browser and Edge pin this revision before asynchronous work. This is checked
-- at the final storage boundary under the same lock, not only at request entry.
create or replace function public.enforce_account_storage_consent()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare owner_id uuid := (to_jsonb(new)->>tg_argv[0])::uuid;
  request_revision text;
begin
  if tg_op='UPDATE' and (to_jsonb(old)->>tg_argv[0])::uuid is distinct from owner_id then
    raise exception 'STORAGE_OWNER_IMMUTABLE' using errcode='42501';
  end if;
  if tg_table_name='account_journal_operations' and tg_op='UPDATE'
    and to_jsonb(new)->'proposed_encrypted_payload'='null'::jsonb
    and (to_jsonb(new)-'proposed_encrypted_payload')=(to_jsonb(old)-'proposed_encrypted_payload') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  if public.account_storage_operations_ready() is distinct from true then
    raise exception 'STORAGE_OPERATIONS_REVIEW_REQUIRED' using errcode='42501';
  end if;
  if public.account_storage_subject_allowed(owner_id) is distinct from true then
    raise exception 'STORAGE_CONSENT_REQUIRED' using errcode='42501';
  end if;
  if tg_table_name in ('external_activity_inbox','external_daily_observations') then
    if not exists(select 1 from public.external_provider_connections p
      where p.id=(to_jsonb(new)->>'connection_id')::uuid and p.user_id=owner_id and p.connection_status='ACTIVE'
        and p.connection_epoch=(to_jsonb(new)->>'connection_epoch')::uuid) then
      raise exception 'STORAGE_PROVIDER_CONNECTION_CHANGED' using errcode='42501';
    end if;
  else
    request_revision := coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)
      ->>'x-trainoracle-storage-revision';
    if not exists(select 1 from public.account_storage_consents c where c.user_id=owner_id
      and c.revision::text=request_revision) then
      raise exception 'STORAGE_CONSENT_REVISION_CHANGED' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_account_storage_consent() from public,anon,authenticated,service_role;
create or replace function public.get_account_storage_consent(expected_user_id_input uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); c public.account_storage_consents%rowtype;
  receipt public.account_storage_erasure_receipts%rowtype;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if actor is null or actor is distinct from expected_user_id_input
    or public.current_jwt_session_active() is distinct from true then
    raise exception 'STORAGE_CONSENT_IDENTITY_REQUIRED' using errcode='42501';
  end if;
  select * into c from public.account_storage_consents where user_id=actor;
  select * into receipt from public.account_storage_erasure_receipts
    where user_id=actor and consent_revision=c.revision;
  return jsonb_build_object('userId',actor,'revision',coalesce(c.revision,0),'purposeVersion','2026-10-05',
    'healthStorage',coalesce(c.purpose_version='2026-10-05' and c.health_storage,false),
    'journalTextStorage',coalesce(c.purpose_version='2026-10-05' and c.journal_text_storage,false),
    'decidedAt',c.decided_at,'operationsReady',public.account_storage_operations_ready(),
    'liveErasedAt',receipt.live_erased_at,'backupStatus',receipt.backup_status);
end;
$$;
revoke all on function public.get_account_storage_consent(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_account_storage_consent(uuid) to authenticated;
comment on table public.account_storage_consents is
  'Purpose withdrawal atomically erases live mixed health/text storage. Local device data and independent account/purchase ledgers are not erased by this operation.';
comment on table public.account_storage_erasure_receipts is
  'Minimal no-content erasure receipt; backup PENDING is not completed erasure. Legal basis, bounded retention, backup deadline and verified cleanup remain release-blocking operator decisions.';
-- Fulfil withdrawals recorded by 0057 before this additive repair, under the
-- same per-owner lock. This is scoped purpose erasure, not account deletion.
do $$ declare c record; begin
  for c in select user_id,revision from public.account_storage_consents
    where not(health_storage and journal_text_storage) order by user_id loop
    perform public.erase_withdrawn_account_storage(c.user_id,c.revision);
  end loop;
end $$;
commit;
