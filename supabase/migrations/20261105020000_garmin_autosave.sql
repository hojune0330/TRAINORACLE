-- Explicit opt-in only. Existing connections remain REVIEW. No runtime activation.
begin;
alter table public.garmin_connections
  add column save_mode text not null default 'REVIEW' check(save_mode in ('AUTO','REVIEW')),
  add column save_preference_revision bigint not null default 0,
  add column save_consent_version text,
  add column save_consented_at timestamptz,
  add column save_events jsonb not null default '[]',
  add column last_saved_at timestamptz;
alter table public.garmin_inbox
  add column autosave_due_at timestamptz not null default clock_timestamp(),
  add column auto_review_required boolean not null default false,
  add column saved_automatically boolean not null default false;

create function public.preserve_garmin_dismissal() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if old.state='DISMISSED' and new.source_revision<>old.source_revision then new.state:='DISMISSED';end if;
  return new;
end $$;
revoke all on function public.preserve_garmin_dismissal() from public,anon,authenticated,service_role;
create trigger preserve_garmin_dismissal before update on public.garmin_inbox for each row execute function public.preserve_garmin_dismissal();

create function public.reset_garmin_save_epoch() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.epoch is distinct from old.epoch then
    new.save_mode:='REVIEW';new.save_consent_version:=null;new.save_consented_at:=null;
    new.save_preference_revision:=old.save_preference_revision+1;new.last_saved_at:=null;
  end if;
  return new;
end $$;
revoke all on function public.reset_garmin_save_epoch() from public,anon,authenticated,service_role;
create trigger reset_garmin_save_epoch before update of epoch on public.garmin_connections
  for each row execute function public.reset_garmin_save_epoch();

create function public.garmin_autosave_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare req jsonb; action text; secret bytea; key_scope text; actor uuid; claims jsonb:=auth.jwt();
  c public.garmin_connections%rowtype; item public.garmin_inbox%rowtype;
  proof jsonb; journal jsonb; journal_secret bytea; saved_receipt jsonb; doc uuid; metadata jsonb;
begin
  if request_text is null or octet_length(request_text)>1600000 or signature is null or signature !~ '^[a-f0-9]{64}$'
    then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
  select k.secret,k.scope into secret,key_scope from public.garmin_integration_keys k where k.key_id=$3 and k.enabled;
  if secret is null or extensions.hmac(convert_to(request_text,'UTF8'),secret,'sha256')<>decode(signature,'hex')
    then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
  req:=request_text::jsonb;action:=req->>'action';
  if req->>'domain' is distinct from 'trainoracle.garmin.autosave.v1'
    or coalesce(req->>'expiresAt','') !~ '^[0-9]{1,12}$'
    or (req->>'expiresAt')::numeric<=extract(epoch from clock_timestamp())
    or (req->>'expiresAt')::numeric>extract(epoch from clock_timestamp())+90
    or coalesce(req->>'configHash','') !~ '^[a-f0-9]{64}$'
    then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
  if key_scope='RUNTIME' then
    actor:=auth.uid();
    if claims->>'role' is distinct from 'authenticated' or actor is null or action not in ('status','preferences') or action is null
      or req->>'ownerId' is distinct from actor::text or req->>'sessionId' is distinct from claims->>'session_id'
      or coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' or (claims->>'exp')::numeric<=extract(epoch from clock_timestamp())
      or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
        where s.id=(claims->>'session_id')::uuid and s.user_id=actor and (s.not_after is null or s.not_after>clock_timestamp())
        and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp()))
      then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
  elsif key_scope='RELAY' and claims->>'role'='service_role' and action in ('next','commit','review','defer') then
    if action='next' then
      select i.user_id into actor from public.garmin_inbox i join public.garmin_connections x on x.user_id=i.user_id and x.epoch=i.epoch
        where i.state='PENDING' and not i.auto_review_required and i.autosave_due_at<=clock_timestamp() and x.state='ACTIVE' and x.save_mode='AUTO'
        and x.config_hash=req->>'configHash' and x.save_consent_version='GARMIN_AUTO_SAVE_2026_11_05'
        and public.account_storage_subject_allowed(x.user_id) is true
        and exists(select 1 from public.account_storage_consents s where s.user_id=x.user_id and s.revision=x.consent_revision and s.health_storage and s.journal_text_storage)
        order by i.received_at,i.inbox_id limit 1;
      if actor is null then return jsonb_build_object('row',null);end if;
    else actor:=(req->>'ownerId')::uuid;end if;
  else raise exception 'GARMIN_DENIED' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:'||actor::text,0));
  select * into c from public.garmin_connections where user_id=actor for update;
  if action='status' then return jsonb_build_object('saveMode',coalesce(c.save_mode,'REVIEW'),'preferenceRevision',coalesce(c.save_preference_revision,0),
    'lastSavedAt',c.last_saved_at,'reviewRequiredCount',(select count(*) from public.garmin_inbox where user_id=actor and epoch=c.epoch and (auto_review_required or state='CONFLICT')),
    'reconnectRequired',coalesce(c.state='ERROR',false));end if;
  if c.user_id is null or c.config_hash is distinct from req->>'configHash' or public.account_storage_subject_allowed(actor) is not true
    or not exists(select 1 from public.account_storage_consents s where s.user_id=actor and s.revision=c.consent_revision and s.health_storage and s.journal_text_storage)
    or not exists(select 1 from public.garmin_integration_controls where approved and config_hash=c.config_hash and valid_until>clock_timestamp())
    or public.service_feature_enabled('ACCOUNT') is not true or public.service_feature_enabled('DEVICE_INTEGRATION') is not true
    or public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is not true then return jsonb_build_object('error','CONNECTION_CHANGED');end if;
  if action='preferences' then
    if req->>'epoch' is distinct from c.epoch::text or c.state not in ('ACTIVE','PENDING')
      or (req->>'consentRevision')::bigint is distinct from c.consent_revision
      or (req->>'expectedPreferenceRevision')::bigint is distinct from c.save_preference_revision
      then return jsonb_build_object('error','CONSENT_CHANGED');end if;
    if req->>'saveMode' is null or req->>'saveMode' not in ('AUTO','REVIEW')
      or req->>'consentVersion' is distinct from 'GARMIN_AUTO_SAVE_2026_11_05' then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
    update public.garmin_connections set save_mode=req->>'saveMode',save_preference_revision=save_preference_revision+1,
      save_consent_version=req->>'consentVersion',save_consented_at=clock_timestamp(),
      save_events=save_events||jsonb_build_array(jsonb_build_object('mode',req->>'saveMode','version',req->>'consentVersion','at',clock_timestamp(),'epoch',epoch)) where user_id=actor;
    return jsonb_build_object('kind','updated');
  end if;
  if c.state<>'ACTIVE' or not ('ACTIVITY_EXPORT'=any(c.permissions)) or c.save_mode<>'AUTO'
    or c.save_consent_version is distinct from 'GARMIN_AUTO_SAVE_2026_11_05' then return jsonb_build_object('error','CONSENT_CHANGED');end if;
  if action='next' then
    select * into item from public.garmin_inbox where user_id=actor and epoch=c.epoch and state='PENDING' and not auto_review_required and autosave_due_at<=clock_timestamp() order by received_at,inbox_id limit 1;
    return jsonb_build_object('row',case when item.inbox_id is null then null else to_jsonb(item)||jsonb_build_object('save_preference_revision',c.save_preference_revision,'storage_consent_revision',c.consent_revision) end);
  end if;
  if req->>'epoch' is distinct from c.epoch::text or (req->>'preferenceRevision')::bigint is distinct from c.save_preference_revision then return jsonb_build_object('error','CONSENT_CHANGED');end if;
  select * into item from public.garmin_inbox where user_id=actor and epoch=c.epoch and inbox_id=(req->>'inboxId')::uuid for update;
  if item.inbox_id is null or item.source_revision is distinct from (req->>'expectedRevision')::bigint then return jsonb_build_object('error','SOURCE_CHANGED');end if;
  if item.state='CONFIRMED' then return jsonb_build_object('kind','already_confirmed');end if;
  if item.state<>'PENDING' or item.auto_review_required then return jsonb_build_object('error','SOURCE_CHANGED');end if;
  if action='defer' then update public.garmin_inbox set autosave_due_at=clock_timestamp()+interval '5 minutes' where inbox_id=item.inbox_id;return jsonb_build_object('kind','deferred');end if;
  if action='review' then update public.garmin_inbox set auto_review_required=true where inbox_id=item.inbox_id;return jsonb_build_object('kind','review_required');end if;
  proof:=req->'journalProof';journal:=(proof->>'request_text')::jsonb;metadata:=journal->'metadata';doc:=(req->>'documentId')::uuid;
  select k.secret into journal_secret from public.account_journal_gateway_keys k where k.key_id=proof->>'key_id' and k.enabled;
  if journal_secret is null or proof->>'signature' is null
    or extensions.hmac(convert_to(proof->>'request_text','UTF8'),journal_secret,'sha256')<>decode(proof->>'signature','hex')
    or journal->>'domain' is distinct from 'trainoracle.account-journal.gateway.v1' or journal->>'ownerId' is distinct from actor::text
    or journal->>'action' is distinct from 'commit' or journal->>'expectedRevision' is distinct from '0'
    or journal->>'operationId' is distinct from req->>'operationId' or journal->>'documentId' is distinct from doc::text
    or (journal->>'expiresAt')::bigint is null or (journal->>'expiresAt')::bigint<extract(epoch from clock_timestamp())
    or (journal->>'expiresAt')::bigint>extract(epoch from clock_timestamp())+120
    or metadata->>'kind' is distinct from 'JOURNAL' or metadata->>'awardAllowed' is distinct from 'false'
    or jsonb_typeof(metadata->'eligible') is distinct from 'boolean' or metadata->>'occurrenceId' is not null
    or metadata->>'journalDate' is null or public.account_journal_envelope_valid(journal->'encryptedPayload') is not true
    or req->>'journalEntryId' is null then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
  -- Insert-only: no overwritten memo, restored tombstone or second copy after reconnect.
  -- A same-date record is a conservative cross-provider/file duplicate candidate.
  if exists(select 1 from public.account_journal_documents where user_id=actor and document_id=doc)
    or exists(select 1 from public.account_journal_identity where user_id=actor and (document_id=doc or journal_date=(metadata->>'journalDate')::date)) then
    update public.garmin_inbox set auto_review_required=true where inbox_id=item.inbox_id;return jsonb_build_object('kind','review_required');end if;
  insert into public.account_journal_cutovers values(actor) on conflict do nothing;
  insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values(actor,doc,1,journal->'encryptedPayload');
  insert into public.account_journal_identity(user_id,document_id,document_kind,journal_date,award_allowed,active)
    values(actor,doc,'JOURNAL',(metadata->>'journalDate')::date,false,true);
  saved_receipt:=jsonb_build_object('kind','saved','documentId',doc,'operationId',req->>'operationId','revision',1);
  update public.garmin_inbox set state='CONFIRMED',document_id=doc,journal_entry_id=req->>'journalEntryId',receipt=saved_receipt,
    confirmation_operation=(req->>'operationId')::uuid,saved_automatically=true where inbox_id=item.inbox_id;
  update public.garmin_connections set last_saved_at=clock_timestamp() where user_id=actor;
  return jsonb_build_object('kind','saved');
end $$;
revoke all on function public.garmin_autosave_attested(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.garmin_autosave_attested(text,text,text) to authenticated,service_role;
commit;
