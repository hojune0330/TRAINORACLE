-- Owner-approved account-canonical foundation only; no runtime enablement or
-- automatic audit/LLM/sharing consumer. Key custody, encryption, final journal
-- schema, retention workflow, finalization, rewards and legacy cutover are separate.
begin;

alter table public.service_feature_controls
  drop constraint service_feature_controls_feature_key_check;
alter table public.service_feature_controls
  add constraint service_feature_controls_feature_key_check check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD',
    'PLAN_BACKUP', 'PUBLIC_PROFILE', 'DEVICE_INTEGRATION', 'ACCOUNT_JOURNAL_V2'
  ));
alter table public.service_feature_control_events
  drop constraint service_feature_control_events_feature_key_check;
alter table public.service_feature_control_events
  add constraint service_feature_control_events_feature_key_check check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD',
    'PLAN_BACKUP', 'PUBLIC_PROFILE', 'DEVICE_INTEGRATION', 'ACCOUNT_JOURNAL_V2'
  ));
insert into public.service_feature_controls(feature_key, enabled, change_reason)
values ('ACCOUNT_JOURNAL_V2', false, 'INITIAL_SAFE_DEFAULT')
on conflict (feature_key) do nothing;

-- Structural ciphertext envelope gate, NOT cryptographic validity or final
-- journal-schema validation. Synthetic bytes can pass; no decryption occurs.
-- Ciphertext limit is 1 MiB decoded, including the GCM authentication tag.
create function public.account_journal_envelope_valid(payload jsonb)
returns boolean
language plpgsql immutable
set search_path = pg_catalog
as $$
declare
  decoded bytea;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then return false; end if;
  if not (payload ?& array['version','algorithm','keyId','iv','ciphertext'])
    or payload - array['version','algorithm','keyId','iv','ciphertext'] <> '{}'::jsonb
    or payload->'version' <> '1'::jsonb
    or payload->'algorithm' <> '"AES-GCM"'::jsonb
    or jsonb_typeof(payload->'keyId') <> 'string'
    or jsonb_typeof(payload->'iv') <> 'string'
    or jsonb_typeof(payload->'ciphertext') <> 'string' then return false; end if;
  if char_length(payload->>'keyId') not between 1 and 80
    or btrim(payload->>'keyId') = ''
    or (payload->>'iv') !~ '^[A-Za-z0-9+/]{16}$'
    or length(payload->>'ciphertext') not between 24 and 1398104
    or (payload->>'ciphertext') !~ '^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
    then return false; end if;
  if octet_length(decode(payload->>'iv', 'base64')) <> 12 then return false; end if;
  decoded := decode(payload->>'ciphertext', 'base64');
  return octet_length(decoded) between 16 and 1048576
    and replace(encode(decoded, 'base64'), E'\n', '') = payload->>'ciphertext';
exception when invalid_parameter_value or invalid_text_representation then
  return false;
end;
$$;
revoke all on function public.account_journal_envelope_valid(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.account_journal_envelope_valid(jsonb) to authenticated;

create table public.account_journal_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  revision bigint not null check (revision between 1 and 9007199254740990),
  encrypted_payload jsonb not null check (public.account_journal_envelope_valid(encrypted_payload)),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, document_id)
);
create table public.account_journal_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  document_id uuid not null,
  expected_revision bigint not null check (expected_revision between 0 and 9007199254740990),
  proposed_encrypted_payload jsonb not null check (public.account_journal_envelope_valid(proposed_encrypted_payload)),
  result jsonb not null,
  primary key (user_id, operation_id)
);
alter table public.account_journal_documents enable row level security;
alter table public.account_journal_operations enable row level security;
revoke all on table public.account_journal_documents, public.account_journal_operations
  from public, anon, authenticated, service_role;
grant select on table public.account_journal_documents, public.account_journal_operations to authenticated;
create policy account_journal_documents_select_own on public.account_journal_documents
for select to authenticated using (
  user_id = auth.uid() and public.account_network_access_allowed(user_id)
  and public.service_feature_enabled('ACCOUNT')
  and public.service_feature_enabled('ACCOUNT_JOURNAL_V2')
);
create policy account_journal_operations_select_own on public.account_journal_operations
for select to authenticated using (
  user_id = auth.uid() and public.account_network_access_allowed(user_id)
  and public.service_feature_enabled('ACCOUNT')
  and public.service_feature_enabled('ACCOUNT_JOURNAL_V2')
);

create function public.commit_account_journal_document(
  document_id uuid, operation_id uuid, expected_revision bigint, encrypted_payload jsonb
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  owner_id uuid := auth.uid();
  prior public.account_journal_operations%rowtype;
  current_revision bigint;
  receipt jsonb;
begin
  if owner_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.service_feature_enabled('ACCOUNT')
    or not public.service_feature_enabled('ACCOUNT_JOURNAL_V2')
    or public.account_network_access_allowed(owner_id) is not true then
    raise exception 'ACCOUNT_JOURNAL_ACCESS_DENIED' using errcode = '42501';
  end if;
  if document_id is null or operation_id is null or expected_revision is null
    or expected_revision not between 0 and 9007199254740990
    or not public.account_journal_envelope_valid(encrypted_payload) then
    raise exception 'INVALID_ACCOUNT_JOURNAL_REQUEST' using errcode = '22023';
  end if;
  -- One transaction lock per account covers absent documents AND operation IDs.
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text, 0));
  select o.* into prior from public.account_journal_operations o
    where o.user_id = owner_id and o.operation_id = $2;
  if found then
    if prior.document_id is distinct from $1 or prior.expected_revision is distinct from $3
      or prior.proposed_encrypted_payload is distinct from $4 then
      raise exception 'ACCOUNT_JOURNAL_OPERATION_REUSED' using errcode = '22023';
    end if;
    return prior.result;
  end if;
  select d.revision into current_revision from public.account_journal_documents d
    where d.user_id = owner_id and d.document_id = $1;
  current_revision := coalesce(current_revision, 0);
  if current_revision <> expected_revision then
    receipt := jsonb_build_object('kind', 'conflict', 'documentId', document_id,
      'operationId', operation_id, 'currentRevision', current_revision);
  else
    if current_revision = 9007199254740990 then
      raise exception 'ACCOUNT_JOURNAL_REVISION_EXHAUSTED' using errcode = '22023';
    end if;
    current_revision := current_revision + 1;
    if expected_revision = 0 then
      insert into public.account_journal_documents(user_id, document_id, revision, encrypted_payload)
        values(owner_id, $1, current_revision, $4);
    else
      update public.account_journal_documents d
        set revision = current_revision, encrypted_payload = $4, updated_at = clock_timestamp()
        where d.user_id = owner_id and d.document_id = $1;
    end if;
    receipt := jsonb_build_object('kind', 'saved', 'documentId', document_id,
      'operationId', operation_id, 'revision', current_revision);
  end if;
  -- Retain the full proposal even when no document exists or CAS conflicts.
  insert into public.account_journal_operations(user_id, operation_id, document_id,
    expected_revision, proposed_encrypted_payload, result)
    values(owner_id, $2, $1, $3, $4, receipt);
  return receipt;
end;
$$;
revoke all on function public.commit_account_journal_document(uuid, uuid, bigint, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.commit_account_journal_document(uuid, uuid, bigint, jsonb) to authenticated;

commit;
