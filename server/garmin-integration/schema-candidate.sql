-- REVIEW CANDIDATE ONLY. Not applied to any hosted project. Existing migrations
-- 0001..0062 are prerequisites; never bulk-push old migrations to install this.
-- No provider approval, operational review, feature or key is enabled here.
begin;
create table public.garmin_integration_controls (
  singleton boolean primary key default true check(singleton), approved boolean not null default false,
  config_hash text not null check(config_hash ~ '^[a-f0-9]{64}$'), evidence_reference text not null,
  valid_until timestamptz not null
);
create table public.garmin_integration_keys (
  key_id text primary key, secret bytea not null check(octet_length(secret)=32),
  scope text not null check(scope in ('RUNTIME','RELAY')), enabled boolean not null default false
);
create table public.garmin_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  connection_id uuid unique not null, epoch uuid not null, state text not null check(state in ('PENDING','ACTIVE','REVOKED','ERROR')),
  subject_hash text unique, credential jsonb, credential_revision bigint not null default 0,
  refresh_nonce uuid, refresh_until timestamptz, consent_revision bigint not null,
  config_hash text not null, last_sync_at timestamptz, updated_at timestamptz not null default clock_timestamp()
  ,permissions text[] not null default '{}', permissions_changed_at bigint
);
create table public.garmin_oauth_attempts (
  state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null, connection_id uuid not null, epoch uuid not null,
  encrypted_verifier jsonb not null, expires_at timestamptz not null,
  consumed_at timestamptz, completed boolean not null default false
);
create table public.garmin_inbox (
  inbox_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null, epoch uuid not null, activity_hash text not null,
  source_revision bigint not null check(source_revision>0), payload_digest text not null,
  state text not null check(state in ('PENDING','CONFIRMED','DISMISSED','DELETED','CONFLICT')),
  encrypted_observation jsonb, detail_manifest jsonb not null default '[]',
  encrypted_context jsonb, core_digest text,
  document_id uuid, journal_entry_id text, receipt jsonb, confirmation_operation uuid,
  received_at timestamptz not null default clock_timestamp(),
  unique(connection_id,epoch,activity_hash)
);
create table public.garmin_detail_parts (
  inbox_id uuid not null references public.garmin_inbox(inbox_id) on delete cascade,
  source_revision bigint not null, part_index integer not null check(part_index between 0 and 31),
  encrypted_part jsonb not null check(octet_length(encrypted_part::text)<350000),
  primary key(inbox_id,source_revision,part_index)
);
create table public.garmin_delivery_events (
  connection_id uuid not null, epoch uuid not null, event_hash text not null,
  payload_digest text not null, result jsonb not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(connection_id,epoch,event_hash)
);
create table public.garmin_revocation_outbox (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null, epoch uuid not null, credential jsonb not null,
  config_hash text not null, completed_at timestamptz
);
create table public.garmin_push_jobs (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null, epoch uuid not null, config_hash text not null,
  feed text not null, encrypted_parts jsonb not null, status text not null default 'PENDING'
    check(status in ('PENDING','PROCESSED','REVIEW_REQUIRED','STALE')),
  lease_id uuid, lease_until timestamptz, created_at timestamptz not null default clock_timestamp()
);
do $$ declare name text; begin foreach name in array array['garmin_integration_controls','garmin_integration_keys','garmin_connections',
  'garmin_oauth_attempts','garmin_inbox','garmin_detail_parts','garmin_delivery_events','garmin_revocation_outbox','garmin_push_jobs'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',name);
end loop; end $$;

-- Extend purpose-withdrawal erasure to this new storage only. Do not replace the
-- existing withdrawal function, lower its grants, or use withdrawal as rollback.
create function public.erase_withdrawn_garmin_storage() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.health_storage is distinct from true or new.journal_text_storage is distinct from true then
    perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:'||new.user_id::text,0));
    delete from public.garmin_inbox where user_id=new.user_id;
    delete from public.garmin_delivery_events where user_id=new.user_id;
    delete from public.garmin_oauth_attempts where user_id=new.user_id;
    delete from public.garmin_revocation_outbox where user_id=new.user_id;
    delete from public.garmin_push_jobs where user_id=new.user_id;
    update public.garmin_connections set state='REVOKED',epoch=extensions.gen_random_uuid(),credential=null,
      refresh_nonce=null,refresh_until=null,updated_at=clock_timestamp() where user_id=new.user_id;
  end if;
  return new;
end $$;
revoke all on function public.erase_withdrawn_garmin_storage() from public,anon,authenticated,service_role;
create trigger garmin_storage_withdrawal_erasure after insert or update on public.account_storage_consents
  for each row execute function public.erase_withdrawn_garmin_storage();

create function public.garmin_integration_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  req jsonb; action text; claims jsonb:=auth.jwt(); actor uuid; sid uuid; secret bytea; scope text;
  c public.garmin_connections%rowtype; a public.garmin_oauth_attempts%rowtype; item public.garmin_inbox%rowtype;
  prior public.garmin_delivery_events%rowtype; ready boolean; consent bigint; journal_receipt jsonb; result jsonb;
  part jsonb; index integer; journal_request jsonb; proof jsonb; inbox_key uuid; source_rev bigint;
  job public.garmin_push_jobs%rowtype;
  revoke_row public.garmin_revocation_outbox%rowtype;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if request_text is null or octet_length(request_text)>9000000 or signature is null or signature!~'^[a-f0-9]{64}$' then
    raise exception 'GARMIN_DENIED' using errcode='42501'; end if;
  select k.secret,k.scope into secret,scope from public.garmin_integration_keys k where k.key_id=$3 and k.enabled;
  if secret is null or extensions.hmac(convert_to(request_text,'UTF8'),secret,'sha256')<>decode(signature,'hex') then
    raise exception 'GARMIN_DENIED' using errcode='42501'; end if;
  req:=request_text::jsonb;action:=req->>'action';
  if req->>'domain' is distinct from 'trainoracle.garmin.integration.v1'
    or coalesce(req->>'expiresAt','')!~'^[0-9]{1,12}$'
    or (req->>'expiresAt')::numeric<=extract(epoch from clock_timestamp())
    or (req->>'expiresAt')::numeric>extract(epoch from clock_timestamp())+90 then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
  if scope='RELAY' then
    if claims->>'role' is distinct from 'service_role' or action not in ('resolve','resolveSubject','enqueue','jobs','completeJob','ingestWire','ingest','revocations','revoked') then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
    if action='jobs' then
      select * into job from public.garmin_push_jobs j where status='PENDING' and config_hash=req->>'configHash'
        and (lease_until is null or lease_until<clock_timestamp())
        and exists(select 1 from public.garmin_integration_controls where approved and config_hash=req->>'configHash' and valid_until>clock_timestamp())
        and public.service_feature_enabled('DEVICE_INTEGRATION') is true and public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is true
        and public.account_storage_subject_allowed(j.user_id) is true
        and exists(select 1 from public.garmin_connections ready_connection where ready_connection.user_id=j.user_id and ready_connection.connection_id=j.connection_id
          and ready_connection.epoch=j.epoch and ready_connection.state='ACTIVE' and 'ACTIVITY_EXPORT'=any(ready_connection.permissions))
        order by created_at,id limit 1 for update skip locked;
      if job.id is null then return jsonb_build_object('job',null);end if;
      update public.garmin_push_jobs set lease_id=(req->>'lease')::uuid,lease_until=clock_timestamp()+interval '60 seconds' where id=job.id;
      return jsonb_build_object('job',to_jsonb(job));
    end if;
    if action='completeJob' then
      if req->>'outcome' not in ('PROCESSED','REVIEW_REQUIRED','STALE') then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
      update public.garmin_push_jobs set status=req->>'outcome',encrypted_parts=case when req->>'outcome'='REVIEW_REQUIRED' then encrypted_parts else '[]'::jsonb end,
        lease_id=null,lease_until=null where id=(req->>'id')::uuid and lease_id=(req->>'lease')::uuid and lease_until>clock_timestamp();
      return jsonb_build_object('kind','completed');
    end if;
    if action in ('revocations','revoked') then
      if action='revocations' then return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r)) from
        (select * from public.garmin_revocation_outbox where completed_at is null order by id limit 10)r),'[]'::jsonb));end if;
      update public.garmin_revocation_outbox set completed_at=clock_timestamp(),credential='null'::jsonb
        where id=(req->>'id')::uuid and completed_at is null;
      return jsonb_build_object('kind','revoked');
    end if;
    if action='resolveSubject' then select * into c from public.garmin_connections where subject_hash=req->>'subjectHash';
    else select * into c from public.garmin_connections where connection_id=(req->>'connectionId')::uuid;end if;
    actor:=c.user_id;if actor is null then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
  else
    if scope is distinct from 'RUNTIME' or claims->>'role' is distinct from 'authenticated'
      or claims->>'sub' is distinct from auth.uid()::text or claims->>'session_id' is null
      or action is null or action not in ('status','disconnect','ackRevocation','revocationStatus','begin','consume','complete','verify','leaseRefresh','finishRefresh','failRefresh','inbox','read','detail','dismiss','confirm') then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
    actor:=auth.uid();sid:=(claims->>'session_id')::uuid;
    if actor is null or req->>'ownerId' is distinct from actor::text or req->>'sessionId' is distinct from sid::text
      or coalesce(claims->>'exp','')!~'^[0-9]{1,12}$' or (claims->>'exp')::numeric<=extract(epoch from clock_timestamp())
      or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=sid and s.user_id=actor
        and (s.not_after is null or s.not_after>clock_timestamp()) and u.deleted_at is null and not coalesce(u.is_anonymous,false)
        and (u.banned_until is null or u.banned_until<=clock_timestamp())) then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
  end if;
  -- Same owner lock as journal CAS and consent withdrawal; never hold a DB lock over HTTP.
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:'||actor::text,0));
  select * into c from public.garmin_connections where user_id=actor for update;
  select revision into consent from public.account_storage_consents where user_id=actor and health_storage and journal_text_storage;
  ready:=exists(select 1 from public.garmin_integration_controls where approved and config_hash=req->>'configHash' and valid_until>clock_timestamp())
    and public.account_storage_subject_allowed(actor) is true and public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is true
    and public.service_feature_enabled('DEVICE_INTEGRATION') is true;
  -- A provider's withdrawal notification closes local access even while new
  -- imports are stopped. It cannot enable permissions or resurrect a connection.
  if action='resolveSubject' then
    if c.config_hash is distinct from req->>'configHash' or public.account_storage_subject_allowed(actor) is distinct from true then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
    return jsonb_build_object('ownerId',actor,'connectionId',c.connection_id,'epoch',c.epoch,'state',c.state);
  end if;
  if action='enqueue' and req->>'feed' in ('deregistrations','userPermissionsChange') then
    if c.epoch::text is distinct from req->>'epoch' or c.subject_hash is distinct from req->>'subjectHash' then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
    if req->>'feed'='deregistrations' then
      update public.garmin_connections set state='REVOKED',epoch=extensions.gen_random_uuid(),credential=null,permissions='{}',refresh_nonce=null,refresh_until=null where user_id=actor;
      delete from public.garmin_oauth_attempts where user_id=actor;
      update public.garmin_revocation_outbox set completed_at=clock_timestamp(),credential='null'::jsonb where user_id=actor and completed_at is null;
    elsif (req->>'changeTime')::bigint>=coalesce(c.permissions_changed_at,0) then
      update public.garmin_connections set permissions=array(select jsonb_array_elements_text(req->'permissions')),
        permissions_changed_at=(req->>'changeTime')::bigint,
        state=case when not (req->'permissions' ? 'ACTIVITY_EXPORT') then 'ERROR' else state end
        where user_id=actor;
    end if;
    return jsonb_build_object('kind','notification_recorded');
  end if;
  if action='status' then return jsonb_build_object('ready',ready,'connection',case when c.user_id is null then null else
    jsonb_build_object('state',c.state,'epoch',c.epoch,'lastSyncAt',c.last_sync_at)end,'pendingCount',(select count(*) from public.garmin_inbox where user_id=actor and epoch=c.epoch and state in ('PENDING','CONFLICT')));end if;
  -- Local disconnect always works, including after operational kill switch.
  if action='ackRevocation' then
    update public.garmin_revocation_outbox set completed_at=clock_timestamp(),credential='null'::jsonb where id=(req->>'id')::uuid and user_id=actor;
    return jsonb_build_object('kind','revoked');
  end if;
  if action='revocationStatus' then return jsonb_build_object('pending',exists(select 1 from public.garmin_revocation_outbox where user_id=actor and completed_at is null));end if;
  if action='disconnect' then
    if c.credential is not null then insert into public.garmin_revocation_outbox(id,user_id,connection_id,epoch,credential,config_hash)
      values(extensions.gen_random_uuid(),actor,c.connection_id,c.epoch,c.credential,c.config_hash);end if;
    update public.garmin_connections set state='REVOKED',epoch=extensions.gen_random_uuid(),credential=null,refresh_nonce=null,refresh_until=null,updated_at=clock_timestamp() where user_id=actor;
    delete from public.garmin_oauth_attempts where user_id=actor;
    select * into revoke_row from public.garmin_revocation_outbox where user_id=actor and completed_at is null order by id limit 1;
    return jsonb_build_object('kind','disconnected','remoteRevocationPending',revoke_row.id is not null,'revocation',case when revoke_row.id is null then null else to_jsonb(revoke_row)end);
  end if;
  if not ready then return jsonb_build_object('error','OPERATIONS_PENDING');end if;
  if scope='RUNTIME' and action not in ('inbox','read','detail') and (coalesce(req->>'consentRevision','')!~'^[1-9][0-9]{0,15}$'
    or (req->>'consentRevision')::bigint is distinct from consent) then return jsonb_build_object('error','CONSENT_CHANGED');end if;
  if action='begin' then
    if c.state='ACTIVE' then return jsonb_build_object('error','ALREADY_CONNECTED');end if;
    -- A delayed DELETE registration must never revoke a newly connected grant.
    -- Complete local/remote disconnect (or receive vendor deregistration) first.
    if c.credential is not null or exists(select 1 from public.garmin_revocation_outbox where user_id=actor and completed_at is null)
      then return jsonb_build_object('error','REVOKE_PENDING');end if;
    delete from public.garmin_oauth_attempts where user_id=actor;
    insert into public.garmin_connections(user_id,connection_id,epoch,state,consent_revision,config_hash)
      values(actor,(req->>'connectionId')::uuid,(req->>'epoch')::uuid,'PENDING',consent,req->>'configHash')
      on conflict(user_id) do update set connection_id=excluded.connection_id,epoch=excluded.epoch,state='PENDING',credential=null,
        credential_revision=0,refresh_nonce=null,refresh_until=null,consent_revision=consent,config_hash=excluded.config_hash;
    insert into public.garmin_oauth_attempts(state_hash,user_id,session_id,connection_id,epoch,encrypted_verifier,expires_at)
      values(req->>'stateHash',actor,sid,(req->>'connectionId')::uuid,(req->>'epoch')::uuid,req->'encryptedVerifier',clock_timestamp()+interval '10 minutes');
    return jsonb_build_object('kind','pending');
  end if;
  if action in ('consume','complete') then
    select * into a from public.garmin_oauth_attempts where state_hash=req->>'stateHash' and user_id=actor and session_id=sid for update;
    if a.user_id is null or a.epoch is distinct from c.epoch or a.connection_id is distinct from c.connection_id
      or a.expires_at<=clock_timestamp() or c.consent_revision is distinct from consent then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
    if a.completed and c.state='ACTIVE' then return jsonb_build_object('kind','already_connected');end if;
    if action='consume' then
      if a.consumed_at is not null or c.state<>'PENDING' then return jsonb_build_object('error','OAUTH_RESTART_REQUIRED');end if;
      update public.garmin_oauth_attempts set consumed_at=clock_timestamp() where state_hash=a.state_hash;
      return jsonb_build_object('connectionId',c.connection_id,'epoch',c.epoch,'encryptedVerifier',a.encrypted_verifier);
    end if;
    if a.consumed_at is null or c.state<>'PENDING' then return jsonb_build_object('error','OAUTH_RESTART_REQUIRED');end if;
    if exists(select 1 from public.garmin_connections where subject_hash=req->>'subjectHash' and user_id<>actor) then return jsonb_build_object('error','PROVIDER_ACCOUNT_ALREADY_BOUND');end if;
    if not (req->'permissions' ? 'ACTIVITY_EXPORT') then return jsonb_build_object('error','PROVIDER_PERMISSION_REQUIRED');end if;
    update public.garmin_connections set state='ACTIVE',subject_hash=req->>'subjectHash',credential=req->'credential',credential_revision=1,
      permissions=array(select jsonb_array_elements_text(req->'permissions')),permissions_changed_at=null,updated_at=clock_timestamp() where user_id=actor;
    update public.garmin_oauth_attempts set completed=true where state_hash=a.state_hash;
    return jsonb_build_object('kind','connected');
  end if;
  if c.state is distinct from 'ACTIVE' or c.consent_revision is distinct from consent or c.config_hash is distinct from req->>'configHash'
    or not ('ACTIVITY_EXPORT'=any(c.permissions)) then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
  if action='enqueue' then
    if c.epoch::text is distinct from req->>'epoch' or c.subject_hash is distinct from req->>'subjectHash' then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
    if jsonb_typeof(req->'encryptedParts') is distinct from 'array' or jsonb_array_length(req->'encryptedParts') not between 1 and 64 then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
    insert into public.garmin_push_jobs(id,user_id,connection_id,epoch,config_hash,feed,encrypted_parts)
      values((req->>'id')::uuid,actor,c.connection_id,c.epoch,c.config_hash,req->>'feed',req->'encryptedParts') on conflict(id) do nothing;
    return jsonb_build_object('kind','queued');
  end if;
  if action='verify' then
    if c.epoch::text is distinct from req->>'epoch' then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
    return jsonb_build_object('kind','current');
  end if;
  if action='leaseRefresh' then
    if c.refresh_until>clock_timestamp() then return jsonb_build_object('error','BUSY');end if;
    -- An expired lease has an ambiguous token-rotation result. Never reuse its token.
    if c.refresh_nonce is not null then update public.garmin_connections set state='ERROR' where user_id=actor;return jsonb_build_object('error','OAUTH_RESTART_REQUIRED');end if;
    update public.garmin_connections set refresh_nonce=(req->>'lease')::uuid,refresh_until=clock_timestamp()+interval '30 seconds' where user_id=actor;
    return jsonb_build_object('connectionId',c.connection_id,'epoch',c.epoch,'credential',c.credential,'credentialRevision',c.credential_revision);
  end if;
  if action in ('finishRefresh','failRefresh') then
    if c.epoch::text is distinct from req->>'epoch' or c.refresh_nonce::text is distinct from req->>'lease' or c.refresh_until<=clock_timestamp()
      or c.credential_revision<>(req->>'credentialRevision')::bigint then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
    if action='failRefresh' then update public.garmin_connections set state='ERROR',credential=case when req ? 'credential' then req->'credential' else credential end
      where user_id=actor;return jsonb_build_object('kind','reconnect_required');end if;
    if not (req->'permissions' ? 'ACTIVITY_EXPORT') then return jsonb_build_object('error','PROVIDER_PERMISSION_REQUIRED');end if;
    update public.garmin_connections set credential=req->'credential',credential_revision=credential_revision+1,refresh_nonce=null,refresh_until=null,
      permissions=array(select jsonb_array_elements_text(req->'permissions')) where user_id=actor;
    return jsonb_build_object('kind','refreshed');
  end if;
  if action in ('resolve','ingest','ingestWire') then
    if c.epoch::text is distinct from req->>'epoch' or c.subject_hash is distinct from req->>'subjectHash' then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
    if action='resolve' then return jsonb_build_object('ownerId',actor,'nextRevision',coalesce((select source_revision+1 from public.garmin_inbox
      where connection_id=c.connection_id and epoch=c.epoch and activity_hash=req->>'activityHash'),1));end if;
    if req->>'ownerId' is distinct from actor::text then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
    select * into prior from public.garmin_delivery_events where connection_id=c.connection_id and epoch=c.epoch and event_hash=req->>'eventHash';
    if found then if prior.payload_digest is distinct from req->>'payloadDigest' then return jsonb_build_object('error','EVENT_REUSED');end if;return prior.result;end if;
    source_rev:=(req->>'sourceRevision')::bigint;if source_rev<1 or source_rev>9007199254740990 then raise exception 'INVALID_REVISION' using errcode='22023';end if;
    select * into item from public.garmin_inbox where connection_id=c.connection_id and epoch=c.epoch and activity_hash=req->>'activityHash' for update;
    -- Garmin push has no documented semantic revision. Never invent arrival order
    -- as source truth. Safe detail enrichment requires identical observed summary.
    if action='ingestWire' and item.inbox_id is not null and item.state<>'DELETED' then
      if item.payload_digest=req->>'contentDigest' or (item.core_digest=req->>'coreDigest'
        and jsonb_array_length(item.detail_manifest)>0 and jsonb_array_length(req->'detailManifest')=0) then
        result:=jsonb_build_object('kind','duplicate','inboxId',item.inbox_id,'revision',item.source_revision);
        insert into public.garmin_delivery_events values(c.connection_id,c.epoch,req->>'eventHash',req->>'payloadDigest',result,actor);
        return result;
      end if;
      if item.core_digest is distinct from req->>'coreDigest' or jsonb_array_length(item.detail_manifest)>0
        or source_rev<>item.source_revision+1 then
        update public.garmin_inbox set state='CONFLICT' where inbox_id=item.inbox_id;
        result:=jsonb_build_object('kind','conflict','inboxId',item.inbox_id,'revision',item.source_revision);
        insert into public.garmin_delivery_events values(c.connection_id,c.epoch,req->>'eventHash',req->>'payloadDigest',result,actor);
        return result;
      end if;
    end if;
    if item.inbox_id is not null and (source_rev<item.source_revision or item.state='DELETED') then result:=jsonb_build_object('kind','ignored','inboxId',item.inbox_id,'revision',item.source_revision);
    elsif item.inbox_id is not null and source_rev=item.source_revision then
      if item.payload_digest is distinct from req->>'contentDigest' then update public.garmin_inbox set state='CONFLICT' where inbox_id=item.inbox_id;result:=jsonb_build_object('kind','conflict','inboxId',item.inbox_id,'revision',item.source_revision);
      else result:=jsonb_build_object('kind','duplicate','inboxId',item.inbox_id,'revision',item.source_revision);end if;
    else
      inbox_key:=coalesce(item.inbox_id,(req->>'inboxId')::uuid);
      if item.inbox_id is not null then delete from public.garmin_detail_parts where inbox_id=item.inbox_id;end if;
      insert into public.garmin_inbox(inbox_id,user_id,connection_id,epoch,activity_hash,source_revision,payload_digest,state,encrypted_observation,detail_manifest,encrypted_context,core_digest)
        values(inbox_key,actor,c.connection_id,c.epoch,req->>'activityHash',source_rev,req->>'contentDigest',
          case when req->>'kind'='DELETE' then 'DELETED' when item.document_id is not null then 'CONFLICT' else 'PENDING' end,
          req->'encryptedObservation',coalesce(req->'detailManifest','[]'),req->'encryptedContext',req->>'coreDigest')
        on conflict(connection_id,epoch,activity_hash) do update set source_revision=excluded.source_revision,payload_digest=excluded.payload_digest,
          state=excluded.state,encrypted_observation=excluded.encrypted_observation,detail_manifest=excluded.detail_manifest,encrypted_context=excluded.encrypted_context,core_digest=excluded.core_digest,received_at=clock_timestamp();
      index:=0;for part in select value from jsonb_array_elements(coalesce(req->'encryptedParts','[]')) loop
        insert into public.garmin_detail_parts values(inbox_key,source_rev,index,part);index:=index+1;
      end loop;
      result:=jsonb_build_object('kind',case when req->>'kind'='DELETE' then 'deleted' when item.document_id is not null then 'review_required' else 'accepted' end,'inboxId',inbox_key,'revision',source_rev);
    end if;
    insert into public.garmin_delivery_events values(c.connection_id,c.epoch,req->>'eventHash',req->>'payloadDigest',result,actor);
    update public.garmin_connections set last_sync_at=clock_timestamp() where user_id=actor;
    return result;
  end if;
  if action='inbox' then return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r)) from
    (select * from public.garmin_inbox where user_id=actor and epoch=c.epoch and (req->>'cursor' is null or inbox_id>(req->>'cursor')::uuid) order by inbox_id limit 21)r),'[]'::jsonb));end if;
  if action='read' and req->>'documentId' is not null then select * into item from public.garmin_inbox where user_id=actor and epoch=c.epoch and document_id=(req->>'documentId')::uuid;
  else select * into item from public.garmin_inbox where user_id=actor and epoch=c.epoch and inbox_id=(req->>'inboxId')::uuid for update;end if;
  if item.inbox_id is null then return jsonb_build_object('error','SOURCE_CHANGED');end if;
  if action='read' then return jsonb_build_object('row',to_jsonb(item));end if;
  if item.source_revision is distinct from (req->>'expectedRevision')::bigint then return jsonb_build_object('error','SOURCE_CHANGED');end if;
  if action='detail' then
    if item.state in ('DELETED','CONFLICT') then return jsonb_build_object('error','REVIEW_REQUIRED');end if;
    return jsonb_build_object('row',to_jsonb(item),'part',(select encrypted_part from public.garmin_detail_parts where inbox_id=item.inbox_id and source_revision=item.source_revision and part_index=(req->>'partIndex')::integer));
  end if;
  if action='dismiss' then
    if item.state not in ('PENDING','DISMISSED') then return jsonb_build_object('error','REVIEW_REQUIRED');end if;
    update public.garmin_inbox set state='DISMISSED' where inbox_id=item.inbox_id;
    return jsonb_build_object('kind','dismissed','inboxId',item.inbox_id,'revision',item.source_revision);
  end if;
  if action='confirm' then
    if item.state='CONFIRMED' and item.confirmation_operation::text=req->>'operationId' then return jsonb_build_object('kind','already_confirmed','receipt',item.receipt,'journalEntryId',item.journal_entry_id);end if;
    if item.state<>'PENDING' or item.document_id is not null then return jsonb_build_object('error','REVIEW_REQUIRED');end if;
    proof:=req->'journalProof';journal_request:=(proof->>'request_text')::jsonb;
    if journal_request->>'ownerId' is distinct from actor::text or journal_request->>'action' is distinct from 'commit'
      or journal_request->>'expectedRevision' is distinct from '0' or journal_request->>'operationId' is distinct from req->>'operationId'
      or journal_request->>'documentId' is distinct from req->>'documentId' or journal_request->'metadata'->>'kind' is distinct from 'JOURNAL'
      or journal_request->'metadata'->>'awardAllowed' is distinct from 'false' then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
    -- The existing journal gateway retains encryption/schema/owner/consent/CAS gates.
    -- This wrapper commits the inbox ACK in the SAME transaction as that journal write.
    journal_receipt:=public.mutate_account_journal_attested(proof->>'request_text',proof->>'signature',proof->>'key_id');
    if journal_receipt->>'kind'<>'saved' then return jsonb_build_object('error','OPERATION_CONFLICT');end if;
    update public.garmin_inbox set state='CONFIRMED',document_id=(req->>'documentId')::uuid,journal_entry_id=req->>'journalEntryId',receipt=journal_receipt,
      confirmation_operation=(req->>'operationId')::uuid where inbox_id=item.inbox_id;
    return jsonb_build_object('kind','saved','receipt',journal_receipt,'journalEntryId',req->>'journalEntryId');
  end if;
  raise exception 'GARMIN_DENIED' using errcode='42501';
end $$;
revoke all on function public.garmin_integration_attested(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.garmin_integration_attested(text,text,text) to authenticated,service_role;
commit;
