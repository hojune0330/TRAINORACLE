-- Bind ordinary next-cycle journal guards in the atomic commit fingerprint.
-- Existing plan parts, receipts, owner locks and grants are preserved.
-- No athlete rows or credentials are read by this migration.
begin;
create or replace function public.mutate_account_plan_collection_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  owner_id uuid := public.account_journal_lifecycle_owner();
  signing_key bytea; req jsonb; action text; meta jsonb; idx jsonb; ref jsonb; old_ref jsonb;
  part public.account_plan_collection_parts%rowtype;
  progress_part public.account_plan_collection_parts%rowtype;
  old_progress public.account_plan_collection_parts%rowtype;
  current_index public.account_plan_collection_indexes%rowtype;
  prior public.account_plan_collection_receipts%rowtype;
  source public.account_journal_documents%rowtype;
  request_doc jsonb; receipt jsonb; op uuid; expected bigint; current_revision bigint; legacy jsonb;
  expected_guard jsonb; actual_guard jsonb;
  common_keys text[] := array['domain','ownerId','action','expiresAt'];
begin
  if request_text is null or octet_length(request_text)>1600000
    or signature is null or signature !~ '^[a-f0-9]{64}$' then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode='42501';
  end if;
  select k.secret into signing_key from public.account_journal_gateway_keys k where k.key_id=$3 and k.enabled;
  if signing_key is null or extensions.hmac(convert_to(request_text,'UTF8'),signing_key,'sha256')
    <> decode(signature,'hex') then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode='42501';
  end if;
  req := request_text::jsonb;
  if req->>'domain' is distinct from 'trainoracle.account-journal.gateway.v1'
    or req->>'ownerId' is distinct from owner_id::text
    or jsonb_typeof(req->'expiresAt') is distinct from 'number'
    or req->>'expiresAt' !~ '^[0-9]{1,12}$'
    or (req->>'expiresAt')::numeric < extract(epoch from clock_timestamp())
    or (req->>'expiresAt')::numeric > extract(epoch from clock_timestamp())+120 then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode='42501';
  end if;
  action := req->>'action';
  if action is null or action not in ('planStage','planCommit') then
    raise exception 'INVALID_ACCOUNT_PLAN_REQUEST' using errcode='22023';
  end if;
  if not public.account_journal_envelope_valid(req->'payload') then
    raise exception 'INVALID_ACCOUNT_PLAN_PAYLOAD' using errcode='22023';
  end if;
  if octet_length(decode(req->'payload'->>'ciphertext','base64')) > 500016 then
    raise exception 'INVALID_ACCOUNT_PLAN_PAYLOAD' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  -- A queued request cannot outlive consent/feature withdrawal or its attestation.
  perform public.account_journal_lifecycle_owner();
  if (req->>'expiresAt')::numeric < extract(epoch from clock_timestamp()) then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode='42501';
  end if;
  if action='planStage' then
    meta := req->'metadata';
    if not public.account_plan_exact(req,common_keys || array['partId','partKind','planId','contentHash','payload','metadata'])
      or not public.account_plan_hash_valid(req->'partId') or not public.account_plan_hash_valid(req->'planId')
      or not public.account_plan_hash_valid(req->'contentHash')
      or not public.account_plan_exact(meta,array['snapshotId','updatedAt','archivedAt'])
      or req->>'partKind' is null or req->>'partKind' not in ('PLAN_SNAPSHOT','PLAN_PROGRESS') then
      raise exception 'INVALID_ACCOUNT_PLAN_PART' using errcode='22023';
    end if;
    if req->>'partKind'='PLAN_SNAPSHOT' then
      if meta <> '{"snapshotId":null,"updatedAt":null,"archivedAt":null}'::jsonb
        or req->>'partId' <> public.account_plan_hash('trainoracle.account-plan-collection.v1',
          jsonb_build_object('kind','PLAN_SNAPSHOT','planId',req->>'planId')) then
        raise exception 'INVALID_ACCOUNT_PLAN_PART' using errcode='22023';
      end if;
    else
      if not public.account_plan_hash_valid(meta->'snapshotId') or not public.account_plan_time_valid(meta->'updatedAt')
        or (meta->'archivedAt' <> 'null'::jsonb and (not public.account_plan_time_valid(meta->'archivedAt')
          or meta->>'archivedAt' < meta->>'updatedAt'))
        or meta->>'snapshotId' <> public.account_plan_hash('trainoracle.account-plan-collection.v1',
          jsonb_build_object('kind','PLAN_SNAPSHOT','planId',req->>'planId')) then
        raise exception 'INVALID_ACCOUNT_PLAN_PART' using errcode='22023';
      end if;
    end if;
    select p.* into part from public.account_plan_collection_parts p where p.user_id=owner_id
      and p.part_kind=req->>'partKind' and p.part_id=req->>'partId';
    if found then
      if part.plan_id is distinct from req->>'planId' or part.content_hash is distinct from req->>'contentHash'
        or part.metadata is distinct from meta then
        raise exception 'ACCOUNT_PLAN_PART_IMMUTABLE' using errcode='22023';
      end if;
      -- Identical plaintext may have a fresh nonce: keep the first ciphertext.
    else
      insert into public.account_plan_collection_parts values(owner_id,req->>'partKind',req->>'partId',
        req->>'planId',req->>'contentHash',req->'payload',meta);
    end if;
    return jsonb_build_object('kind','staged','partId',req->>'partId');
  end if;

  if not public.account_plan_exact(req, common_keys || array['operationId','expectedRevision',
    'previousIndexFingerprint','previousCurrentPlanId','index','indexFingerprint','requestFingerprint','payload','legacy']
    || case when req ? 'journalGuard' then array['journalGuard'] else array[]::text[] end)
    or jsonb_typeof(req->'operationId') is distinct from 'string'
    or req->>'operationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    or jsonb_typeof(req->'expectedRevision') is distinct from 'number'
    or req->>'expectedRevision' !~ '^[0-9]{1,16}$'
    or (req->>'expectedRevision')::numeric not between 0 and 9007199254740989
    or not public.account_plan_hash_valid(req->'indexFingerprint')
    or not public.account_plan_hash_valid(req->'requestFingerprint')
    or (req->'previousIndexFingerprint' <> 'null'::jsonb and not public.account_plan_hash_valid(req->'previousIndexFingerprint'))
    or (req->'previousCurrentPlanId' <> 'null'::jsonb and not public.account_plan_hash_valid(req->'previousCurrentPlanId')) then
    raise exception 'INVALID_ACCOUNT_PLAN_COMMIT' using errcode='22023';
  end if;
  op := (req->>'operationId')::uuid; expected := (req->>'expectedRevision')::bigint;
  idx := req->'index'; legacy := req->'legacy';
  if not public.account_plan_exact(idx,array['version','kind','documentFingerprint','currentPlanId','plans'])
    or idx->'version' is distinct from '1'::jsonb or idx->>'kind' is distinct from 'PLAN_COLLECTION'
    or not public.account_plan_hash_valid(idx->'documentFingerprint')
    or (idx->'currentPlanId' <> 'null'::jsonb and not public.account_plan_hash_valid(idx->'currentPlanId'))
    or jsonb_typeof(idx->'plans') is distinct from 'array' then
    raise exception 'INVALID_ACCOUNT_PLAN_INDEX' using errcode='22023';
  end if;
  if jsonb_array_length(idx->'plans')>100 or octet_length(public.account_plan_canonical(idx))>500000 then
    raise exception 'INVALID_ACCOUNT_PLAN_INDEX' using errcode='22023';
  end if;
  for ref in select value from jsonb_array_elements(idx->'plans') loop
    if not public.account_plan_exact(ref,array['planId','snapshotId','snapshotHash','progressId','progressHash'])
      or exists(select 1 from jsonb_each(ref) e where not public.account_plan_hash_valid(e.value)) then
      raise exception 'INVALID_ACCOUNT_PLAN_REFERENCE' using errcode='22023';
    end if;
  end loop;
  if (select count(distinct value->>'planId') from jsonb_array_elements(idx->'plans')) <> jsonb_array_length(idx->'plans')
    or (idx->>'currentPlanId' is not null and not exists(select 1 from jsonb_array_elements(idx->'plans') r
      where r->>'planId'=idx->>'currentPlanId')) then
    raise exception 'INVALID_ACCOUNT_PLAN_INDEX' using errcode='22023';
  end if;
  if legacy <> 'null'::jsonb then
    if not public.account_plan_exact(legacy,array['documentId','revision','fingerprint'])
      or legacy->>'documentId' is distinct from public.account_plan_legacy_id(owner_id)::text
      or jsonb_typeof(legacy->'revision') is distinct from 'number'
      or legacy->>'revision' !~ '^[0-9]{1,16}$'
      or (legacy->>'revision')::numeric not between 1 and 9007199254740990
      or not public.account_plan_hash_valid(legacy->'fingerprint') then
      raise exception 'INVALID_ACCOUNT_PLAN_LEGACY' using errcode='22023';
    end if;
  end if;
  request_doc := jsonb_build_object('ownerId',owner_id,'operationId',op,'expectedRevision',expected,
    'previousIndexFingerprint',req->'previousIndexFingerprint','previousCurrentPlanId',req->'previousCurrentPlanId',
    'index',idx,'legacy',legacy);
  if req ? 'journalGuard' then
    if jsonb_typeof(req->'journalGuard') is distinct from 'array'
      or jsonb_array_length(req->'journalGuard')>5000 then
      raise exception 'INVALID_REPLAN_GUARD' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_array_elements(req->'journalGuard') v
      where not public.account_plan_exact(v,array['documentId','revision'])
        or jsonb_typeof(v->'documentId') is distinct from 'string'
        or v->>'documentId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        or jsonb_typeof(v->'revision') is distinct from 'number'
        or v->>'revision' !~ '^[1-9][0-9]{0,15}$') then
      raise exception 'INVALID_REPLAN_GUARD' using errcode='22023';
    end if;
    request_doc := request_doc || jsonb_build_object('journalGuard',req->'journalGuard');
  end if;
  if req->>'indexFingerprint' <> public.account_plan_hash('trainoracle.account-plan.v1',idx)
    or req->>'requestFingerprint' <> public.account_plan_hash('trainoracle.account-plan.v1',request_doc) then
    raise exception 'INVALID_ACCOUNT_PLAN_FINGERPRINT' using errcode='22023';
  end if;
  select r.* into prior from public.account_plan_collection_receipts r where r.user_id=owner_id and r.operation_id=op;
  if found then
    if prior.request_fingerprint is distinct from req->>'requestFingerprint' or prior.request_document is distinct from request_doc then
      raise exception 'ACCOUNT_PLAN_OPERATION_REUSED' using errcode='22023';
    end if;
    return jsonb_build_object('kind','committed','receipt',prior.receipt);
  end if;
  -- Direct attested calls cannot bypass the journal precondition. Replay above
  -- still returns the original receipt after a lost acknowledgement.
  if req ? 'journalGuard' then
    select coalesce(jsonb_agg(v order by v->>'documentId'),'[]'::jsonb) into expected_guard
      from jsonb_array_elements(req->'journalGuard') v;
    select coalesce(jsonb_agg(jsonb_build_object('documentId',d.document_id,'revision',d.revision)
      order by d.document_id::text),'[]'::jsonb) into actual_guard
      from public.account_journal_documents d
      join public.account_journal_identity i on i.user_id=d.user_id and i.document_id=d.document_id
      where d.user_id=owner_id and d.deleted_at is null and i.document_kind='JOURNAL';
    if expected_guard is distinct from actual_guard then return jsonb_build_object('kind','conflict'); end if;
  end if;
  select i.* into current_index from public.account_plan_collection_indexes i where i.user_id=owner_id;
  current_revision := coalesce(current_index.revision,0);
  if current_revision<>expected or current_index.index_fingerprint is distinct from req->>'previousIndexFingerprint'
    or current_index.index_document->>'currentPlanId' is distinct from req->>'previousCurrentPlanId' then
    return jsonb_build_object('kind','conflict');
  end if;
  select d.* into source from public.account_journal_documents d
    where d.user_id=owner_id and d.document_id=public.account_plan_legacy_id(owner_id);
  if legacy <> 'null'::jsonb then
    if current_revision<>0 or source.document_id is null or source.deleted_at is not null
      or source.revision<>(legacy->>'revision')::bigint
      or exists(select 1 from public.account_journal_identity i where i.user_id=owner_id
        and i.document_id=source.document_id and i.document_kind<>'PLAN') then
      return jsonb_build_object('kind','conflict');
    end if;
  elsif current_revision=0 and (source.document_id is not null or exists(
    select 1 from public.account_journal_identity i where i.user_id=owner_id and i.document_kind='PLAN')) then
    return jsonb_build_object('kind','conflict');
  end if;
  for ref in select value from jsonb_array_elements(idx->'plans') loop
    select p.* into part from public.account_plan_collection_parts p where p.user_id=owner_id
      and p.part_kind='PLAN_SNAPSHOT' and p.part_id=ref->>'snapshotId';
    select p.* into progress_part from public.account_plan_collection_parts p where p.user_id=owner_id
      and p.part_kind='PLAN_PROGRESS' and p.part_id=ref->>'progressId';
    if part.part_id is null or progress_part.part_id is null
      or part.plan_id is distinct from ref->>'planId' or part.content_hash is distinct from ref->>'snapshotHash'
      or progress_part.plan_id is distinct from ref->>'planId' or progress_part.content_hash is distinct from ref->>'progressHash'
      or progress_part.metadata->>'snapshotId' is distinct from ref->>'snapshotId'
      or (idx->>'currentPlanId'=ref->>'planId' and progress_part.metadata->>'archivedAt' is not null) then
      raise exception 'ACCOUNT_PLAN_REFERENCE_MISMATCH' using errcode='22023';
    end if;
  end loop;
  for old_ref in select value from jsonb_array_elements(coalesce(current_index.index_document->'plans','[]'::jsonb)) loop
    select value into ref from jsonb_array_elements(idx->'plans') where value->>'planId'=old_ref->>'planId';
    if ref is null or ref->>'snapshotId' is distinct from old_ref->>'snapshotId'
      or ref->>'snapshotHash' is distinct from old_ref->>'snapshotHash' then
      raise exception 'ACCOUNT_PLAN_HISTORY_CHANGED' using errcode='22023';
    end if;
    select p.* into old_progress from public.account_plan_collection_parts p where p.user_id=owner_id
      and p.part_kind='PLAN_PROGRESS' and p.part_id=old_ref->>'progressId';
    select p.* into progress_part from public.account_plan_collection_parts p where p.user_id=owner_id
      and p.part_kind='PLAN_PROGRESS' and p.part_id=ref->>'progressId';
    if progress_part.metadata->>'updatedAt' < old_progress.metadata->>'updatedAt'
      or (old_progress.metadata->>'archivedAt' is not null and ref is distinct from old_ref)
      or (current_index.index_document->>'currentPlanId'=old_ref->>'planId'
        and idx->>'currentPlanId' is distinct from old_ref->>'planId' and progress_part.metadata->>'archivedAt' is null) then
      raise exception 'ACCOUNT_PLAN_HISTORY_CHANGED' using errcode='22023';
    end if;
  end loop;
  receipt := jsonb_build_object('ownerId',owner_id,'operationId',op,'revision',current_revision+1,
    'indexFingerprint',req->>'indexFingerprint','requestFingerprint',req->>'requestFingerprint');
  insert into public.account_plan_collection_indexes values(owner_id,current_revision+1,req->>'indexFingerprint',idx,req->'payload')
    on conflict(user_id) do update set revision=excluded.revision,index_fingerprint=excluded.index_fingerprint,
      index_document=excluded.index_document,payload=excluded.payload;
  insert into public.account_plan_collection_receipts values(owner_id,op,req->>'requestFingerprint',request_doc,receipt);
  return jsonb_build_object('kind','committed','receipt',receipt);
end;
$$;

create or replace function public.mutate_account_plan_replan_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  owner_id uuid := public.account_journal_lifecycle_owner();
  signing_key bytea; req jsonb; expected jsonb; actual jsonb; stripped text; stripped_signature text;
begin
  if request_text is null or octet_length(request_text)>1600000
    or signature is null or signature !~ '^[a-f0-9]{64}$' then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode='42501';
  end if;
  select k.secret into signing_key from public.account_journal_gateway_keys k where k.key_id=$3 and k.enabled;
  if signing_key is null or extensions.hmac(convert_to(request_text,'UTF8'),signing_key,'sha256') <> decode(signature,'hex') then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode='42501';
  end if;
  req := request_text::jsonb;
  if req->>'domain' is distinct from 'trainoracle.account-journal.gateway.v1'
    or req->>'ownerId' is distinct from owner_id::text or req->>'action' is distinct from 'planCommit'
    or jsonb_typeof(req->'journalGuard') is distinct from 'array'
    or jsonb_array_length(req->'journalGuard')>5000 then
    raise exception 'INVALID_REPLAN_GUARD' using errcode='22023';
  end if;
  -- The same owner lock is held by journal create/edit/delete and plan commits.
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  perform public.account_journal_lifecycle_owner();
  -- New successor requests bind journalGuard in their client fingerprint.
  -- Legacy replan requests bind it inside their immutable plan receipt instead.
  if req->>'requestFingerprint' = public.account_plan_hash('trainoracle.account-plan.v1',
    jsonb_build_object('ownerId',req->'ownerId','operationId',req->'operationId',
      'expectedRevision',req->'expectedRevision','previousIndexFingerprint',req->'previousIndexFingerprint',
      'previousCurrentPlanId',req->'previousCurrentPlanId','index',req->'index',
      'legacy',req->'legacy','journalGuard',req->'journalGuard')) then
    stripped := req::text;
  else
    stripped := (req-'journalGuard')::text;
  end if;
  stripped_signature := encode(extensions.hmac(convert_to(stripped,'UTF8'),signing_key,'sha256'),'hex');
  -- An existing receipt answers a lost ACK even when journals changed afterwards.
  if exists(select 1 from public.account_plan_collection_receipts r
    where r.user_id=owner_id and r.operation_id=(req->>'operationId')::uuid) then
    return public.mutate_account_plan_collection_attested(stripped,stripped_signature,key_id);
  end if;
  if exists(select 1 from jsonb_array_elements(req->'journalGuard') v
    where not public.account_plan_exact(v,array['documentId','revision'])
      or jsonb_typeof(v->'documentId') is distinct from 'string'
      or v->>'documentId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      or jsonb_typeof(v->'revision') is distinct from 'number'
      or v->>'revision' !~ '^[1-9][0-9]{0,15}$') then
    raise exception 'INVALID_REPLAN_GUARD' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(v order by v->>'documentId'),'[]'::jsonb) into expected from jsonb_array_elements(req->'journalGuard') v;
  select coalesce(jsonb_agg(jsonb_build_object('documentId',d.document_id,'revision',d.revision) order by d.document_id::text),'[]'::jsonb)
    into actual from public.account_journal_documents d
    join public.account_journal_identity i on i.user_id=d.user_id and i.document_id=d.document_id
    where d.user_id=owner_id and d.deleted_at is null and i.document_kind='JOURNAL';
  if expected is distinct from actual then return jsonb_build_object('kind','conflict'); end if;
  -- Original routine validates expiry, CAS, immutable history, index and receipt binding.
  return public.mutate_account_plan_collection_attested(stripped,stripped_signature,key_id);
end;
$$;
commit;
