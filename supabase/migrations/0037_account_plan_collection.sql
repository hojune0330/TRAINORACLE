-- Local-only implementation. No feature switches, keys, source rows or jobs changed.
-- Signed gateway validates/decrypts the personal body, part hashes/progress IDs and
-- index ciphertext equality. SQL independently enforces references/CAS/lineage.
-- IDs are owner-neutral codec references; every storage key includes the owner.
begin;

create function public.account_plan_exact(value jsonb, keys text[])
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(jsonb_typeof(value) = 'object' and value ?& keys
    and value - keys = '{}'::jsonb, false);
$$;
create function public.account_plan_hash_valid(value jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(jsonb_typeof(value) = 'string' and value #>> '{}' ~ '^sha256:[a-f0-9]{64}$', false);
$$;
-- This canonicalizer is only used on bounded ASCII reference/index/receipt inputs,
-- never on personal training bodies or arbitrary floating-point numbers.
create function public.account_plan_canonical(value jsonb)
returns text language plpgsql immutable set search_path = pg_catalog as $$
begin
  case jsonb_typeof(value)
    when 'object' then return '{' || coalesce((select string_agg(to_jsonb(key)::text || ':' ||
      public.account_plan_canonical(val), ',' order by key collate "C") from jsonb_each(value) e(key,val)), '') || '}';
    when 'array' then return '[' || coalesce((select string_agg(public.account_plan_canonical(val), ',' order by n)
      from jsonb_array_elements(value) with ordinality e(val,n)), '') || ']';
    else return value::text;
  end case;
end;
$$;
create function public.account_plan_hash(domain text, value jsonb)
returns text language sql immutable set search_path = pg_catalog as $$
  select 'sha256:' || encode(sha256(convert_to(domain,'UTF8') || decode('00','hex') ||
    convert_to(public.account_plan_canonical(value),'UTF8')), 'hex');
$$;
create function public.account_plan_legacy_id(owner_id uuid)
returns uuid language plpgsql immutable set search_path = pg_catalog as $$
declare bytes bytea;
begin
  bytes := sha256(convert_to('["trainoracle.account.plan.v1","' || owner_id::text || '"]','UTF8'));
  bytes := set_byte(set_byte(bytes,6,(get_byte(bytes,6) & 15) | 80),8,(get_byte(bytes,8) & 63) | 128);
  return encode(substring(bytes from 1 for 16),'hex')::uuid;
end;
$$;
create function public.account_plan_time_valid(value jsonb)
returns boolean language plpgsql stable set search_path = pg_catalog as $$
declare stamp timestamptz;
begin
  if jsonb_typeof(value) is distinct from 'string'
    or value #>> '{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' then return false; end if;
  stamp := (value #>> '{}')::timestamptz;
  return to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') = value #>> '{}'
    and stamp <= clock_timestamp();
exception when others then return false;
end;
$$;

create table public.account_plan_collection_parts (
  user_id uuid not null references auth.users(id) on delete cascade,
  part_kind text not null check (part_kind in ('PLAN_SNAPSHOT','PLAN_PROGRESS')),
  part_id text not null check (part_id ~ '^sha256:[a-f0-9]{64}$'),
  plan_id text not null check (plan_id ~ '^sha256:[a-f0-9]{64}$'),
  content_hash text not null check (content_hash ~ '^sha256:[a-f0-9]{64}$'),
  payload jsonb not null check (public.account_journal_envelope_valid(payload)),
  metadata jsonb not null,
  primary key(user_id,part_kind,part_id)
);
create table public.account_plan_collection_indexes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision between 1 and 9007199254740990),
  index_fingerprint text not null check (index_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  index_document jsonb not null,
  payload jsonb not null check (public.account_journal_envelope_valid(payload))
);
create table public.account_plan_collection_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request_fingerprint text not null,
  request_document jsonb not null,
  receipt jsonb not null,
  primary key(user_id,operation_id)
);
alter table public.account_plan_collection_parts enable row level security;
alter table public.account_plan_collection_indexes enable row level security;
alter table public.account_plan_collection_receipts enable row level security;
revoke all on public.account_plan_collection_parts, public.account_plan_collection_indexes,
  public.account_plan_collection_receipts from public,anon,authenticated,service_role;

create function public.guard_account_plan_monolithic_write()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid; doc uuid; is_plan boolean;
begin
  if tg_op = 'DELETE' then owner_id := old.user_id; doc := old.document_id;
  else owner_id := new.user_id; doc := new.document_id; end if;
  -- Allow auth.users deletion cascades; no API bypass based on a missing JWT.
  if not exists(select 1 from auth.users where id = owner_id) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  is_plan := doc = public.account_plan_legacy_id(owner_id)
    or exists(select 1 from public.account_journal_identity i
      where i.user_id=owner_id and i.document_id=doc and i.document_kind='PLAN');
  if tg_table_name = 'account_journal_identity' then
    if tg_op <> 'DELETE' then is_plan := is_plan or new.document_kind='PLAN'; end if;
    if tg_op <> 'INSERT' then is_plan := is_plan or old.document_kind='PLAN'; end if;
  end if;
  if tg_op = 'UPDATE' then
    -- Identity/key moves are not an API operation; cannot move a protected source.
    if old.user_id is distinct from new.user_id or old.document_id is distinct from new.document_id then
      raise exception 'ACCOUNT_PLAN_IDENTITY_CHANGED' using errcode='22023';
    end if;
  end if;
  if is_plan and exists(select 1 from public.account_plan_collection_indexes i where i.user_id=owner_id) then
    raise exception 'ACCOUNT_PLAN_MONOLITHIC_WRITE_DENIED' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
create trigger account_plan_monolithic_document_guard before insert or update or delete
  on public.account_journal_documents for each row execute function public.guard_account_plan_monolithic_write();
create trigger account_plan_monolithic_identity_guard before insert or update or delete
  on public.account_journal_identity for each row execute function public.guard_account_plan_monolithic_write();

create function public.mutate_account_plan_collection_attested(request_text text, signature text, key_id text)
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
    'previousIndexFingerprint','previousCurrentPlanId','index','indexFingerprint','requestFingerprint','payload','legacy'])
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

create function public.read_account_plan_collection_index()
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := public.account_journal_lifecycle_owner(); result jsonb;
begin
  select jsonb_build_object('revision',i.revision,'index_fingerprint',i.index_fingerprint,
    'index_document',i.index_document,'payload',i.payload) into result
    from public.account_plan_collection_indexes i where i.user_id=owner_id;
  return result;
end;
$$;
create function public.read_account_plan_collection_part(part_kind text, part_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := public.account_journal_lifecycle_owner(); result jsonb;
begin
  if $1 is null or $1 not in ('PLAN_SNAPSHOT','PLAN_PROGRESS') or $2 is null or $2 !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'INVALID_ACCOUNT_PLAN_REFERENCE' using errcode='22023';
  end if;
  select jsonb_build_object('part_kind',p.part_kind,'part_id',p.part_id,'plan_id',p.plan_id,
    'content_hash',p.content_hash,'payload',p.payload,'metadata',p.metadata) into result
    from public.account_plan_collection_parts p where p.user_id=owner_id and p.part_kind=$1 and p.part_id=$2;
  return result;
end;
$$;
create function public.read_account_plan_collection_receipt(operation_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := public.account_journal_lifecycle_owner(); result jsonb;
begin
  if $1 is null then raise exception 'INVALID_ACCOUNT_PLAN_OPERATION' using errcode='22023'; end if;
  select r.receipt into result from public.account_plan_collection_receipts r where r.user_id=owner_id and r.operation_id=$1;
  return result;
end;
$$;
revoke all on function public.account_plan_exact(jsonb,text[]),public.account_plan_hash_valid(jsonb),
  public.account_plan_canonical(jsonb),public.account_plan_hash(text,jsonb),public.account_plan_legacy_id(uuid),
  public.account_plan_time_valid(jsonb),public.guard_account_plan_monolithic_write(),
  public.mutate_account_plan_collection_attested(text,text,text),public.read_account_plan_collection_index(),
  public.read_account_plan_collection_part(text,text),public.read_account_plan_collection_receipt(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.mutate_account_plan_collection_attested(text,text,text),
  public.read_account_plan_collection_index(),public.read_account_plan_collection_part(text,text),
  public.read_account_plan_collection_receipt(uuid) to authenticated;
commit;
