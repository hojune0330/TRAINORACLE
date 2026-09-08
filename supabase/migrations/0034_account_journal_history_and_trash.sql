-- Local-reviewed lifecycle extension. No flags, existing rows, keys or jobs changed.
-- Restore copies an eligible encrypted envelope; it never rewinds the CAS counter.
-- Public RPC contract (all authenticated/owner-gated):
-- commit(document_id, operation_id, expected_revision, encrypted_payload): unchanged.
-- delete_account_journal_document(uuid, uuid, bigint): deleted | conflict.
-- restore_account_journal_document(uuid, uuid, bigint, source_revision bigint):
--   restored | conflict | source_unavailable. Success adds sourceRevision.
-- Success receipts: {kind, documentId, operationId, revision}.
-- Conflict receipts: {kind, documentId, operationId, currentRevision}.
-- source_unavailable adds sourceRevision to the conflict-shaped receipt.
-- list_account_journal_history(uuid): [{revision, encryptedPayload, replacedAt,
--   expiresAt, reason: replaced|trash}], descending revision, eligible only.
-- purge_expired_account_journal_history(): {historyPurged, operationPayloadsPurged}.
-- operation_kind is request identity, NEVER a decrypted document/payload kind.
-- Before 0034, superseded proposals had no replacement timestamps: this migration
-- cannot reconstruct their age/history and intentionally performs no backfill.
begin;

alter table public.account_journal_documents
  alter column encrypted_payload drop not null,
  drop constraint account_journal_documents_encrypted_payload_check,
  add column deleted_at timestamptz,
  add constraint account_journal_document_state_check check (
    (deleted_at is null and encrypted_payload is not null
      and public.account_journal_envelope_valid(encrypted_payload))
    or (deleted_at is not null and encrypted_payload is null)
  );

alter table public.account_journal_operations
  alter column proposed_encrypted_payload drop not null,
  drop constraint account_journal_operations_proposed_encrypted_payload_check,
  add column operation_kind text not null default 'commit'
    check (operation_kind in ('commit', 'delete', 'restore')),
  add column source_revision bigint check (source_revision between 1 and 9007199254740990),
  add column payload_fingerprint bytea,
  add column payload_expires_at timestamptz,
  add constraint account_journal_operation_payload_check check (
    (proposed_encrypted_payload is not null
      and public.account_journal_envelope_valid(proposed_encrypted_payload))
    or (proposed_encrypted_payload is null and
      (operation_kind <> 'commit' or payload_fingerprint is not null))
  );

create table public.account_journal_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  revision bigint not null check (revision between 1 and 9007199254740990),
  encrypted_payload jsonb not null check (public.account_journal_envelope_valid(encrypted_payload)),
  replaced_at timestamptz not null,
  expires_at timestamptz not null,
  reason text not null check (reason in ('replaced', 'trash')),
  primary key (user_id, document_id, revision),
  check (expires_at = replaced_at + interval '720 hours')
);
create index account_journal_history_expiry on public.account_journal_history(user_id, expires_at);
create index account_journal_operation_expiry on public.account_journal_operations(user_id, payload_expires_at)
  where payload_expires_at is not null;
alter table public.account_journal_history enable row level security;
revoke all on public.account_journal_history from public, anon, authenticated, service_role;
grant select on public.account_journal_history to authenticated;
create policy account_journal_history_select_own on public.account_journal_history
for select to authenticated using (
  user_id = auth.uid() and public.account_network_access_allowed(user_id)
  and public.service_feature_enabled('ACCOUNT')
  and public.service_feature_enabled('ACCOUNT_JOURNAL_V2')
  and expires_at > clock_timestamp()
);
-- Expiry applies to direct ciphertext reads too, even before physical cleanup.
alter policy account_journal_operations_select_own on public.account_journal_operations
using (
  user_id = auth.uid() and public.account_network_access_allowed(user_id)
  and public.service_feature_enabled('ACCOUNT')
  and public.service_feature_enabled('ACCOUNT_JOURNAL_V2')
  and (proposed_encrypted_payload is null or payload_expires_at is null
    or payload_expires_at > clock_timestamp())
);

create function public.account_journal_lifecycle_owner()
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if public.service_feature_enabled('ACCOUNT') is not true
    or public.service_feature_enabled('ACCOUNT_JOURNAL_V2') is not true
    or public.account_network_access_allowed(owner_id) is not true then
    raise exception 'ACCOUNT_JOURNAL_ACCESS_DENIED' using errcode = '42501';
  end if;
  return owner_id;
end;
$$;
revoke all on function public.account_journal_lifecycle_owner() from public, anon, authenticated, service_role;

-- Private implementation: all wrappers share the 0033 account/operation lock.
create function public.mutate_account_journal_lifecycle(
  document_id uuid, operation_id uuid, expected_revision bigint,
  encrypted_payload jsonb, action_kind text, source_revision bigint
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  owner_id uuid := public.account_journal_lifecycle_owner();
  prior public.account_journal_operations%rowtype;
  current_doc public.account_journal_documents%rowtype;
  current_revision bigint;
  receipt jsonb;
  next_payload jsonb;
  retained_proposal jsonb;
  fingerprint bytea;
  accepted_at timestamptz;
begin
  if document_id is null or operation_id is null or expected_revision is null
    or expected_revision not between 0 and 9007199254740990
    or action_kind is null or action_kind not in ('commit','delete','restore')
    or (action_kind = 'commit' and not public.account_journal_envelope_valid(encrypted_payload))
    or (action_kind <> 'commit' and encrypted_payload is not null)
    or (action_kind = 'restore' and (source_revision is null
      or source_revision not between 1 and 9007199254740990))
    or (action_kind <> 'restore' and source_revision is not null) then
    raise exception 'INVALID_ACCOUNT_JOURNAL_REQUEST' using errcode = '22023';
  end if;
  fingerprint := sha256(convert_to(encrypted_payload::text, 'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text, 0));
  select o.* into prior from public.account_journal_operations o
    where o.user_id = owner_id and o.operation_id = $2;
  if found then
    if prior.document_id is distinct from $1 or prior.expected_revision is distinct from $3
      or prior.operation_kind is distinct from $5 or prior.source_revision is distinct from $6
      or (action_kind = 'commit' and coalesce(prior.payload_fingerprint,
        sha256(convert_to(prior.proposed_encrypted_payload::text, 'UTF8'))) is distinct from fingerprint) then
      raise exception 'ACCOUNT_JOURNAL_OPERATION_REUSED' using errcode = '22023';
    end if;
    return prior.result;
  end if;
  select d.* into current_doc from public.account_journal_documents d
    where d.user_id = owner_id and d.document_id = $1;
  current_revision := coalesce(current_doc.revision, 0);
  -- Read wall clock AFTER waiting for the lock, including in long transactions.
  accepted_at := clock_timestamp();
  next_payload := encrypted_payload;
  retained_proposal := encrypted_payload;
  if action_kind = 'restore' then
    select h.encrypted_payload into next_payload from public.account_journal_history h
      where h.user_id = owner_id and h.document_id = $1 and h.revision = $6
        and h.expires_at > accepted_at;
  end if;
  if current_revision <> expected_revision
    or (action_kind = 'commit' and current_doc.deleted_at is not null)
    or (action_kind = 'delete' and (current_revision = 0 or current_doc.deleted_at is not null))
    or (action_kind = 'restore' and current_revision = 0) then
    receipt := jsonb_build_object('kind', 'conflict', 'documentId', $1,
      'operationId', $2, 'currentRevision', current_revision);
    -- A losing restore keeps its eligible chosen copy beyond history expiry.
    if action_kind = 'restore' then retained_proposal := next_payload; end if;
  else
    if action_kind = 'restore' then
      if next_payload is null then
        receipt := jsonb_build_object('kind', 'source_unavailable', 'documentId', $1,
          'operationId', $2, 'currentRevision', current_revision, 'sourceRevision', $6);
      end if;
    end if;
    if receipt is null then
      if current_revision = 9007199254740990 then
        raise exception 'ACCOUNT_JOURNAL_REVISION_EXHAUSTED' using errcode = '22023';
      end if;
      if current_revision > 0 and current_doc.deleted_at is null then
        insert into public.account_journal_history(user_id, document_id, revision,
          encrypted_payload, replaced_at, expires_at, reason)
        values(owner_id, $1, current_revision, current_doc.encrypted_payload, accepted_at,
          accepted_at + interval '720 hours', case when action_kind = 'delete' then 'trash' else 'replaced' end);
        -- Successful operation copies must not outlive the replaced revision.
        -- Conflicts have no expiry and are never swept by this lifecycle.
        update public.account_journal_operations o
          set payload_expires_at = accepted_at + interval '720 hours',
            payload_fingerprint = coalesce(o.payload_fingerprint,
              sha256(convert_to(o.proposed_encrypted_payload::text, 'UTF8')))
          where o.user_id = owner_id and o.document_id = $1
            and o.result->>'kind' = 'saved'
            and (o.result->>'revision')::bigint = current_revision;
      end if;
      current_revision := current_revision + 1;
      insert into public.account_journal_documents as d(user_id, document_id, revision,
        encrypted_payload, updated_at, deleted_at)
      values(owner_id, $1, current_revision, next_payload, accepted_at,
        case when action_kind = 'delete' then accepted_at else null end)
      on conflict on constraint account_journal_documents_pkey do update
        set revision = excluded.revision, encrypted_payload = excluded.encrypted_payload,
          updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
      receipt := jsonb_build_object('kind', case action_kind when 'delete' then 'deleted'
        when 'restore' then 'restored' else 'saved' end,
        'documentId', $1, 'operationId', $2, 'revision', current_revision);
      if action_kind = 'restore' then
        receipt := receipt || jsonb_build_object('sourceRevision', $6);
      end if;
    end if;
  end if;
  insert into public.account_journal_operations(user_id, operation_id, document_id,
    expected_revision, proposed_encrypted_payload, result, operation_kind, source_revision, payload_fingerprint)
  values(owner_id, $2, $1, $3, retained_proposal, receipt, $5, $6, fingerprint);
  return receipt;
end;
$$;
revoke all on function public.mutate_account_journal_lifecycle(uuid, uuid, bigint, jsonb, text, bigint)
  from public, anon, authenticated, service_role;

create or replace function public.commit_account_journal_document(
  document_id uuid, operation_id uuid, expected_revision bigint, encrypted_payload jsonb
)
returns jsonb language sql security definer set search_path = pg_catalog as $$
  select public.mutate_account_journal_lifecycle($1, $2, $3, $4, 'commit', null);
$$;
create function public.delete_account_journal_document(document_id uuid, operation_id uuid, expected_revision bigint)
returns jsonb language sql security definer set search_path = pg_catalog as $$
  select public.mutate_account_journal_lifecycle($1, $2, $3, null, 'delete', null);
$$;
create function public.restore_account_journal_document(
  document_id uuid, operation_id uuid, expected_revision bigint, source_revision bigint
)
returns jsonb language sql security definer set search_path = pg_catalog as $$
  select public.mutate_account_journal_lifecycle($1, $2, $3, null, 'restore', $4);
$$;

create function public.list_account_journal_history(document_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := public.account_journal_lifecycle_owner(); result jsonb;
begin
  if document_id is null then
    raise exception 'INVALID_ACCOUNT_JOURNAL_REQUEST' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('revision', h.revision,
    'encryptedPayload', h.encrypted_payload, 'replacedAt', h.replaced_at,
    'expiresAt', h.expires_at, 'reason', h.reason) order by h.revision desc), '[]'::jsonb)
    into result from public.account_journal_history h
    where h.user_id = owner_id and h.document_id = $1 and h.expires_at > clock_timestamp();
  return result;
end;
$$;

-- Owner-only maintenance, deliberately NOT scheduled/enabled by this migration.
-- The caller cannot supply a clock or purge another account. RLS/list/restore
-- enforce expiry regardless of scheduling. Receipts and tombstones remain.
create function public.purge_expired_account_journal_history()
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  owner_id uuid := public.account_journal_lifecycle_owner();
  cutoff timestamptz;
  histories bigint;
  payloads bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text, 0));
  cutoff := clock_timestamp();
  delete from public.account_journal_history h where h.user_id = owner_id and h.expires_at <= cutoff;
  get diagnostics histories = row_count;
  update public.account_journal_operations o set proposed_encrypted_payload = null
    where o.user_id = owner_id and o.payload_expires_at <= cutoff
      and o.result->>'kind' = 'saved' and o.proposed_encrypted_payload is not null;
  get diagnostics payloads = row_count;
  return jsonb_build_object('historyPurged', histories, 'operationPayloadsPurged', payloads);
end;
$$;

revoke all on function public.commit_account_journal_document(uuid, uuid, bigint, jsonb),
  public.delete_account_journal_document(uuid, uuid, bigint),
  public.restore_account_journal_document(uuid, uuid, bigint, bigint),
  public.list_account_journal_history(uuid), public.purge_expired_account_journal_history()
  from public, anon, authenticated, service_role;
grant execute on function public.commit_account_journal_document(uuid, uuid, bigint, jsonb),
  public.delete_account_journal_document(uuid, uuid, bigint),
  public.restore_account_journal_document(uuid, uuid, bigint, bigint),
  public.list_account_journal_history(uuid), public.purge_expired_account_journal_history()
  to authenticated;

commit;
