-- Additive maintenance only. No keys, feature flags, consent or approvals are changed.
begin;
do $$ begin
  if to_regprocedure('public.garmin_integration_attested(text,text,text)') is null
    or to_regprocedure('public.account_storage_subject_allowed(uuid)') is null then
    raise exception 'GARMIN_MAINTENANCE_PREREQUISITE_MISSING';
  end if;
end $$;

alter table public.garmin_connections
  add column maintenance_due_at timestamptz not null default clock_timestamp(),
  add column rotation_phase text not null default 'IDLE' check(rotation_phase in ('IDLE','CLAIMED','STARTED','ROTATED')),
  add column rotation_session_id uuid;
alter table public.garmin_revocation_outbox
  add column rotation_nonce uuid,
  add column rotation_phase text not null default 'IDLE' check(rotation_phase in ('IDLE','STARTED'));

create function public.reset_garmin_maintenance_epoch() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.epoch is distinct from old.epoch then
    new.rotation_phase:='IDLE'; new.rotation_session_id:=null; new.maintenance_due_at:=clock_timestamp();
  end if;
  return new;
end $$;
revoke all on function public.reset_garmin_maintenance_epoch() from public,anon,authenticated,service_role;
create trigger reset_garmin_maintenance_epoch before update of epoch on public.garmin_connections
  for each row execute function public.reset_garmin_maintenance_epoch();

-- A disconnect must stop local use immediately, but cannot race a token rotation
-- by revoking/acknowledging the old credential before its successor is retained.
create function public.reserve_garmin_rotating_revocation() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare c public.garmin_connections%rowtype;
begin
  select * into c from public.garmin_connections where user_id=new.user_id;
  if c.connection_id=new.connection_id and c.epoch=new.epoch and c.refresh_nonce is not null
    and c.rotation_phase in ('IDLE','STARTED') then
    new.rotation_nonce:=c.refresh_nonce; new.rotation_phase:='STARTED';
    new.lease_until:=greatest(c.refresh_until,clock_timestamp()+interval '60 seconds');
  end if;
  return new;
end $$;
revoke all on function public.reserve_garmin_rotating_revocation() from public,anon,authenticated,service_role;
create trigger reserve_garmin_rotating_revocation before insert on public.garmin_revocation_outbox
  for each row execute function public.reserve_garmin_rotating_revocation();

create function public.garmin_maintenance_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare req jsonb; action text; secret bytea; actor uuid; c public.garmin_connections%rowtype;
  r public.garmin_revocation_outbox%rowtype; ready boolean; current_subject boolean; current_session boolean; purpose_retained boolean;
  next_due timestamptz; target uuid;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if auth.jwt()->>'role' is distinct from 'service_role' or request_text is null or octet_length(request_text)>50000
    or signature is null or signature !~ '^[a-f0-9]{64}$' then raise exception 'GARMIN_DENIED' using errcode='42501'; end if;
  select k.secret into secret from public.garmin_integration_keys k where k.key_id=$3 and k.enabled and k.scope='RELAY';
  if secret is null or extensions.hmac(convert_to(request_text,'UTF8'),secret,'sha256')<>decode(signature,'hex')
    then raise exception 'GARMIN_DENIED' using errcode='42501'; end if;
  req:=request_text::jsonb; action:=req->>'action';
  if req->>'domain' is distinct from 'trainoracle.garmin.maintenance.v1'
    or coalesce(req->>'expiresAt','') !~ '^[0-9]{1,12}$'
    or (req->>'expiresAt')::numeric<=extract(epoch from clock_timestamp())
    or (req->>'expiresAt')::numeric>extract(epoch from clock_timestamp())+90
    or coalesce(req->>'configHash','') !~ '^[a-f0-9]{64}$'
    or action is null or action not in ('claim','start','save','finish','fail','defer','abortBeforeExchange','claimRevocation','checkRevocation','startRevocationRotation','saveRevocationRotation','finishRevocation')
    then raise exception 'GARMIN_DENIED' using errcode='42501'; end if;
  ready:=exists(select 1 from public.garmin_integration_controls where approved and config_hash=req->>'configHash' and valid_until>clock_timestamp())
    and public.service_feature_enabled('DEVICE_INTEGRATION') is true and public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is true;
  if action='claim' then
    if not ready then return jsonb_build_object('row',null); end if;
    select user_id into actor from public.garmin_connections x where x.state='ACTIVE' and x.config_hash=req->>'configHash'
      and 'ACTIVITY_EXPORT'=any(x.permissions)
      and x.maintenance_due_at<=clock_timestamp() and (x.refresh_until is null or x.refresh_until<=clock_timestamp())
      and public.account_storage_subject_allowed(x.user_id) is true
      and exists(select 1 from public.account_storage_consents s where s.user_id=x.user_id and s.revision=x.consent_revision and s.health_storage and s.journal_text_storage)
      order by x.maintenance_due_at,x.user_id limit 1;
  elsif action='claimRevocation' then
    select id,user_id into target,actor from public.garmin_revocation_outbox x where x.completed_at is null and x.config_hash=req->>'configHash'
      and x.rotation_phase='IDLE' and (x.lease_until is null or x.lease_until<clock_timestamp()) order by x.id limit 1;
  else actor:=(req->>'ownerId')::uuid;
  end if;
  if actor is null then return jsonb_build_object('row',null); end if;
  -- Never invert the existing journal/consent owner-lock -> row-lock order.
  if action in ('claim','claimRevocation') then
    if not pg_try_advisory_xact_lock(hashtextextended('account_journal_v2:'||actor::text,0)) then return jsonb_build_object('row',null); end if;
  else perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:'||actor::text,0)); end if;
  current_subject:=public.account_storage_subject_allowed(actor) is true;
  select * into c from public.garmin_connections where user_id=actor for update;

  if action in ('claimRevocation','checkRevocation','startRevocationRotation','saveRevocationRotation','finishRevocation') then
    select * into r from public.garmin_revocation_outbox where id=coalesce(target,(req->>'id')::uuid) and user_id=actor
      and config_hash=req->>'configHash' and completed_at is null for update;
    -- Removal is allowed while new collection/account operations are stopped.
    -- Withdrawal/deletion physically erases this row under the same owner lock.
    if r.id is null then return jsonb_build_object('kind','discarded','row',null); end if;
    if action='claimRevocation' then
      if r.rotation_phase<>'IDLE' or r.lease_until>clock_timestamp() then return jsonb_build_object('row',null); end if;
      update public.garmin_revocation_outbox set lease_id=(req->>'lease')::uuid,lease_until=clock_timestamp()+interval '60 seconds'
        where id=r.id returning * into r; return jsonb_build_object('row',to_jsonb(r));
    end if;
    if action='saveRevocationRotation' then
      if r.rotation_nonce::text is distinct from req->>'lease' or r.rotation_phase<>'STARTED'
        or jsonb_typeof(req->'credential') is distinct from 'object' then return jsonb_build_object('kind','discarded'); end if;
      update public.garmin_revocation_outbox set credential=req->'credential',rotation_phase='IDLE',rotation_nonce=null,
        lease_id=case when lease_until>clock_timestamp() then lease_id else null end where id=r.id returning * into r;
      return jsonb_build_object('kind','saved','row',to_jsonb(r));
    end if;
    if r.lease_id::text is distinct from req->>'lease' or r.lease_until<=clock_timestamp() or r.rotation_phase<>'IDLE'
      then return jsonb_build_object('kind','discarded','row',null); end if;
    if action='checkRevocation' then return jsonb_build_object('row',to_jsonb(r)); end if;
    if action='startRevocationRotation' then
      update public.garmin_revocation_outbox set rotation_phase='STARTED',rotation_nonce=r.lease_id where id=r.id;
      return jsonb_build_object('kind','started');
    end if;
    update public.garmin_revocation_outbox set completed_at=clock_timestamp(),credential='null'::jsonb,lease_id=null,lease_until=null where id=r.id;
    return jsonb_build_object('kind','revoked');
  end if;

  purpose_retained:=exists(select 1 from public.account_storage_consents s where s.user_id=actor and s.health_storage and s.journal_text_storage);
  current_subject:=current_subject and exists(select 1 from public.account_storage_consents s where s.user_id=actor
    and s.revision=c.consent_revision and s.health_storage and s.journal_text_storage);
  if action='claim' then
    if c.state<>'ACTIVE' or not('ACTIVITY_EXPORT'=any(c.permissions)) or c.config_hash is distinct from req->>'configHash' or not current_subject
      or c.maintenance_due_at>clock_timestamp() or c.refresh_until>clock_timestamp() then return jsonb_build_object('row',null); end if;
    if c.refresh_nonce is not null and c.rotation_phase<>'CLAIMED' then
      update public.garmin_connections set state='ERROR' where user_id=actor;
      return jsonb_build_object('row',null,'reconnectRequired',true);
    end if;
    update public.garmin_connections set refresh_nonce=(req->>'lease')::uuid,refresh_until=clock_timestamp()+interval '60 seconds',
      rotation_phase='CLAIMED',rotation_session_id=null where user_id=actor returning * into c;
    return jsonb_build_object('row',to_jsonb(c));
  end if;

  -- Only the trusted caller which has not invoked the token endpoint may release
  -- this reservation. A process lost after exchange starts cannot use this action.
  if action='abortBeforeExchange' then
    if purpose_retained and c.connection_id::text=req->>'connectionId' and c.epoch::text=req->>'epoch'
      and c.config_hash=req->>'configHash' and c.refresh_nonce::text=req->>'lease'
      and c.credential_revision=(req->>'credentialRevision')::bigint then
      update public.garmin_connections set refresh_nonce=null,refresh_until=null,rotation_phase='IDLE',rotation_session_id=null where user_id=actor;
      return jsonb_build_object('kind','released');
    end if;
    update public.garmin_revocation_outbox set rotation_nonce=null,rotation_phase='IDLE',lease_id=null,lease_until=null
      where user_id=actor and connection_id::text=req->>'connectionId' and epoch::text=req->>'epoch' and config_hash=req->>'configHash'
        and rotation_nonce::text=req->>'lease' and rotation_phase='STARTED' and completed_at is null;
    return jsonb_build_object('kind','released');
  end if;

  -- The successor may return after local disconnect. Retain it only in the
  -- existing purpose-scoped outbox; withdrawal erases that row and prevents revival.
  if action='save' and (c.epoch::text is distinct from req->>'epoch' or c.refresh_nonce::text is distinct from req->>'lease') then
    select * into r from public.garmin_revocation_outbox where user_id=actor and connection_id::text=req->>'connectionId'
      and epoch::text=req->>'epoch' and config_hash=req->>'configHash' and rotation_nonce::text=req->>'lease'
      and rotation_phase='STARTED' and completed_at is null for update;
    if r.id is not null and jsonb_typeof(req->'credential')='object' then
      update public.garmin_revocation_outbox set credential=req->'credential',rotation_nonce=null,rotation_phase='IDLE',lease_id=null,lease_until=null where id=r.id;
      return jsonb_build_object('kind','revocation_queued');
    end if;
  end if;
  if (action='save' and not purpose_retained) or (action<>'save' and not current_subject)
    or c.connection_id::text is distinct from req->>'connectionId' or c.epoch::text is distinct from req->>'epoch'
    or c.config_hash is distinct from req->>'configHash' or c.refresh_nonce::text is distinct from req->>'lease'
    or c.credential_revision is distinct from (req->>'credentialRevision')::bigint then return jsonb_build_object('kind','discarded'); end if;
  current_session:=c.rotation_session_id is null or exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=c.rotation_session_id and s.user_id=actor and (s.not_after is null or s.not_after>clock_timestamp())
      and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp()));
  if action='save' then
    if c.rotation_phase<>'STARTED' or jsonb_typeof(req->'credential') is distinct from 'object' then return jsonb_build_object('kind','discarded'); end if;
    update public.garmin_connections set credential=req->'credential',credential_revision=credential_revision+1,rotation_phase='ROTATED',
      state=case when state='ACTIVE' and ready and current_subject and current_session and refresh_until>clock_timestamp() then state else 'ERROR' end
      where user_id=actor returning * into c;
    return jsonb_build_object('kind',case when c.state='ACTIVE' then 'saved' else 'retained' end,'credentialRevision',c.credential_revision);
  end if;
  if action='fail' then
    update public.garmin_connections set state='ERROR' where user_id=actor;
    return jsonb_build_object('kind','reconnect_required');
  end if;
  if not ready or not current_session or c.state<>'ACTIVE' or not('ACTIVITY_EXPORT'=any(c.permissions)) or c.refresh_until<=clock_timestamp() then return jsonb_build_object('kind','discarded'); end if;
  if action='start' then
    if c.rotation_phase not in ('IDLE','CLAIMED') then return jsonb_build_object('kind','discarded'); end if;
    if req->>'sessionId' is not null and not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
      where s.id=(req->>'sessionId')::uuid and s.user_id=actor and (s.not_after is null or s.not_after>clock_timestamp())
      and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp()))
      then return jsonb_build_object('kind','discarded'); end if;
    update public.garmin_connections set rotation_phase='STARTED',rotation_session_id=(req->>'sessionId')::uuid where user_id=actor;
    return jsonb_build_object('kind','started');
  end if;
  if action='defer' and c.rotation_phase<>'CLAIMED' or action='finish' and c.rotation_phase<>'ROTATED'
    then return jsonb_build_object('kind','discarded'); end if;
  next_due:=(req->>'nextDueAt')::timestamptz;
  if next_due is null or next_due<clock_timestamp()+interval '30 seconds' or next_due>clock_timestamp()+interval '6 hours 1 minute'
    then raise exception 'GARMIN_DENIED' using errcode='42501'; end if;
  if action='finish' then
    if jsonb_typeof(req->'permissions') is distinct from 'array' or not(req->'permissions' ? 'ACTIVITY_EXPORT') then
      update public.garmin_connections set state='ERROR' where user_id=actor; return jsonb_build_object('kind','reconnect_required'); end if;
    update public.garmin_connections set permissions=array(select jsonb_array_elements_text(req->'permissions')) where user_id=actor;
  end if;
  update public.garmin_connections set maintenance_due_at=next_due,refresh_nonce=null,refresh_until=null,rotation_phase='IDLE',rotation_session_id=null where user_id=actor;
  return jsonb_build_object('kind','completed');
end $$;
revoke all on function public.garmin_maintenance_attested(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.garmin_maintenance_attested(text,text,text) to service_role;
commit;
