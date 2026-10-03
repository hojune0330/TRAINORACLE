-- Bound new unresolved conflict ciphertext without expiring or deleting accepted conflicts.
-- Track only parts staged after this migration. Older parts and all receipts remain untouched.
-- A staged part becomes durable when an index references it. Uncommitted new parts expire
-- after seven days; a signed retry can restage the same part after expiry. The operator-only
-- batch below is intentionally not scheduled or run by this migration.
begin;

create index account_journal_conflict_payload_owner
  on public.account_journal_operations(user_id)
  where result->>'kind' = 'conflict' and proposed_encrypted_payload is not null;

create function public.guard_account_journal_conflict_storage()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare existing_count bigint; existing_bytes bigint; incoming_bytes bigint;
begin
  if new.result->>'kind' is distinct from 'conflict' or new.proposed_encrypted_payload is null then
    return new;
  end if;
  -- The journal writer already holds this lock. Keep privileged inserts serialized too.
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || new.user_id::text, 0));
  incoming_bytes := octet_length(new.proposed_encrypted_payload::text);
  select count(*), coalesce(sum(octet_length(o.proposed_encrypted_payload::text)), 0)
    into existing_count, existing_bytes
    from public.account_journal_operations o
    where o.user_id = new.user_id and o.result->>'kind' = 'conflict'
      and o.proposed_encrypted_payload is not null;
  if existing_count >= 100 or existing_bytes + incoming_bytes > 52428800 then
    raise exception 'ACCOUNT_JOURNAL_CONFLICT_STORAGE_LIMIT' using errcode = 'PZ001';
  end if;
  return new;
end;
$$;
create trigger account_journal_conflict_storage_guard before insert
  on public.account_journal_operations for each row
  execute function public.guard_account_journal_conflict_storage();
revoke all on function public.guard_account_journal_conflict_storage()
  from public, anon, authenticated, service_role;

-- This sidecar records only parts created under this policy. It deliberately does not
-- classify older unreferenced progress parts, which may be needed for historical recovery.
create table public.account_plan_collection_staging (
  user_id uuid not null,
  part_kind text not null,
  part_id text not null,
  staged_at timestamptz not null,
  expires_at timestamptz not null,
  staged_bytes bigint not null check (staged_bytes > 0 and staged_bytes <= 1048576),
  primary key (user_id, part_kind, part_id),
  foreign key (user_id, part_kind, part_id)
    references public.account_plan_collection_parts(user_id, part_kind, part_id) on delete cascade,
  check (expires_at = staged_at + interval '7 days')
);
create index account_plan_collection_staging_expiry
  on public.account_plan_collection_staging(expires_at, user_id);
alter table public.account_plan_collection_staging enable row level security;
revoke all on public.account_plan_collection_staging from public, anon, authenticated, service_role;

create function public.account_plan_part_is_currently_referenced(
  owner_id uuid, kind text, id text
)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(
    select 1 from public.account_plan_collection_indexes i,
      lateral jsonb_array_elements(i.index_document->'plans') ref
    where i.user_id = owner_id and
      ((kind = 'PLAN_SNAPSHOT' and ref->>'snapshotId' = id)
        or (kind = 'PLAN_PROGRESS' and ref->>'progressId' = id))
  );
$$;

create function public.reap_expired_account_plan_staging(owner_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare cutoff timestamptz := clock_timestamp();
begin
  -- Caller holds the account lock. The sidecar exists only for post-0046 staged parts.
  delete from public.account_plan_collection_parts p using public.account_plan_collection_staging s
    where p.user_id = owner_id and s.user_id = p.user_id
      and s.part_kind = p.part_kind and s.part_id = p.part_id
      and s.expires_at <= cutoff
      and not public.account_plan_part_is_currently_referenced(p.user_id,p.part_kind,p.part_id);
  -- A stale marker cannot make an indexed part disposable or consume staging quota.
  delete from public.account_plan_collection_staging s
    where s.user_id = owner_id and s.expires_at <= cutoff
      and public.account_plan_part_is_currently_referenced(s.user_id,s.part_kind,s.part_id);
end;
$$;

create function public.track_account_plan_staging()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare staged_count bigint; staged_total bigint; incoming_bytes bigint; staged_now timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || new.user_id::text, 0));
  -- A fresh part can always reclaim expired, still-uncommitted quota for its owner.
  perform public.reap_expired_account_plan_staging(new.user_id);
  incoming_bytes := octet_length(new.payload::text) + octet_length(new.metadata::text);
  select count(*), coalesce(sum(s.staged_bytes), 0) into staged_count, staged_total
    from public.account_plan_collection_staging s where s.user_id = new.user_id;
  if incoming_bytes > 1048576 or staged_count >= 256
    or staged_total + incoming_bytes > 134217728 then
    raise exception 'ACCOUNT_PLAN_STAGING_STORAGE_LIMIT' using errcode = 'PZ002';
  end if;
  staged_now := clock_timestamp();
  insert into public.account_plan_collection_staging
    (user_id, part_kind, part_id, staged_at, expires_at, staged_bytes)
    values (new.user_id, new.part_kind, new.part_id, staged_now,
      staged_now + interval '7 days', incoming_bytes);
  return new;
end;
$$;
create trigger account_plan_staging_track after insert
  on public.account_plan_collection_parts for each row
  execute function public.track_account_plan_staging();

create function public.guard_account_plan_staging_reference()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare ref jsonb; cutoff timestamptz := clock_timestamp();
begin
  for ref in select value from jsonb_array_elements(new.index_document->'plans') loop
    if exists(select 1 from public.account_plan_collection_staging s
      where s.user_id = new.user_id and s.expires_at <= cutoff
        and ((s.part_kind = 'PLAN_SNAPSHOT' and s.part_id = ref->>'snapshotId')
          or (s.part_kind = 'PLAN_PROGRESS' and s.part_id = ref->>'progressId'))
        and not public.account_plan_part_is_currently_referenced(
          s.user_id, s.part_kind, s.part_id)) then
      raise exception 'ACCOUNT_PLAN_STAGE_EXPIRED' using errcode = 'PZ003';
    end if;
  end loop;
  return new;
end;
$$;
create trigger account_plan_staging_reference_guard before insert or update
  on public.account_plan_collection_indexes for each row
  execute function public.guard_account_plan_staging_reference();

create function public.finalize_account_plan_staging()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- This removes only temporary markers. The referenced ciphertext remains durable.
  delete from public.account_plan_collection_staging s
    where s.user_id = new.user_id and exists(
      select 1 from jsonb_array_elements(new.index_document->'plans') ref
      where (s.part_kind = 'PLAN_SNAPSHOT' and s.part_id = ref->>'snapshotId')
        or (s.part_kind = 'PLAN_PROGRESS' and s.part_id = ref->>'progressId'));
  return new;
end;
$$;
create trigger account_plan_staging_finalize after insert or update
  on public.account_plan_collection_indexes for each row
  execute function public.finalize_account_plan_staging();

create function public.recycle_expired_account_plan_stage(
  owner_id uuid, kind text, id text, expected_plan text, expected_hash text, expected_meta jsonb
)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare expired boolean; prior public.account_plan_collection_parts%rowtype;
begin
  -- Called only inside the signed, owner-gated planStage path under its owner lock.
  select s.expires_at <= clock_timestamp() into expired
    from public.account_plan_collection_staging s
    where s.user_id = owner_id and s.part_kind = kind and s.part_id = id for update of s;
  if expired is not true then return; end if;
  select p.* into prior from public.account_plan_collection_parts p
    where p.user_id=owner_id and p.part_kind=kind and p.part_id=id;
  if prior.plan_id is distinct from expected_plan or prior.content_hash is distinct from expected_hash
    or prior.metadata is distinct from expected_meta then
    raise exception 'ACCOUNT_PLAN_PART_IMMUTABLE' using errcode = '22023';
  end if;
  if public.account_plan_part_is_currently_referenced(owner_id, kind, id) then
    delete from public.account_plan_collection_staging s
      where s.user_id = owner_id and s.part_kind = kind and s.part_id = id;
  else
    -- Only ciphertext newly staged under 0046 can have this marker.
    delete from public.account_plan_collection_parts p
      where p.user_id = owner_id and p.part_kind = kind and p.part_id = id;
  end if;
end;
$$;

-- Preserve 0044's attestation/CAS/replan code and inject retry cleanup inside
-- the signed planStage branch. Any later validation error rolls back this cleanup.
do $$
declare source text; anchor text;
begin
  source := pg_get_functiondef('public.mutate_account_plan_collection_attested(text,text,text)'::regprocedure);
  anchor := 'if action=''planStage'' then';
  if position(anchor in source) = 0
    or length(source) - length(replace(source, anchor, '')) <> length(anchor) then
    raise exception 'ACCOUNT_PLAN_STAGE_ANCHOR_MISSING';
  end if;
  source := replace(source, anchor, anchor ||
    E'\n    perform public.recycle_expired_account_plan_stage(owner_id, req->>''partKind'', req->>''partId'', req->>''planId'', req->>''contentHash'', req->''metadata'');');
  execute source;
end;
$$;

create or replace function public.read_account_plan_collection_part(part_kind text, part_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := public.account_journal_lifecycle_owner(); result jsonb;
begin
  if $1 is null or $1 not in ('PLAN_SNAPSHOT','PLAN_PROGRESS') or $2 is null
    or $2 !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'INVALID_ACCOUNT_PLAN_REFERENCE' using errcode='22023';
  end if;
  select jsonb_build_object('part_kind',p.part_kind,'part_id',p.part_id,'plan_id',p.plan_id,
    'content_hash',p.content_hash,'payload',p.payload,'metadata',p.metadata) into result
    from public.account_plan_collection_parts p
    left join public.account_plan_collection_staging s
      on s.user_id=p.user_id and s.part_kind=p.part_kind and s.part_id=p.part_id
    where p.user_id=owner_id and p.part_kind=$1 and p.part_id=$2
      and (s.part_id is null or s.expires_at > clock_timestamp()
        or public.account_plan_part_is_currently_referenced(p.user_id,p.part_kind,p.part_id));
  return result;
end;
$$;

-- Operator-only maintenance entry point. No grant, cron job or automatic sweep.
-- It can delete only expired, still-unreferenced 0046 staging parts. If an index
-- references one, it removes its stale marker and preserves the ciphertext.
create function public.run_account_plan_staging_retention_batch()
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare candidate record; purged bigint := 0; finalized bigint := 0; affected bigint;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('account_plan_staging_retention_worker', 0)) then
    return jsonb_build_object('kind','already_running');
  end if;
  for candidate in select s.user_id, s.part_kind, s.part_id
    from public.account_plan_collection_staging s
    where s.expires_at <= clock_timestamp()
    order by s.expires_at, s.user_id limit 200 loop
    if not pg_try_advisory_xact_lock(
      hashtextextended('account_journal_v2:' || candidate.user_id::text, 0)) then
      continue;
    end if;
    if public.account_plan_part_is_currently_referenced(
      candidate.user_id, candidate.part_kind, candidate.part_id) then
      delete from public.account_plan_collection_staging s
        where s.user_id=candidate.user_id and s.part_kind=candidate.part_kind
          and s.part_id=candidate.part_id and s.expires_at <= clock_timestamp();
      get diagnostics affected = row_count;
      finalized := finalized + affected;
    else
      delete from public.account_plan_collection_parts p where p.user_id=candidate.user_id
        and p.part_kind=candidate.part_kind and p.part_id=candidate.part_id
        and exists(select 1 from public.account_plan_collection_staging s
          where s.user_id=p.user_id and s.part_kind=p.part_kind and s.part_id=p.part_id
            and s.expires_at <= clock_timestamp());
      if found then purged := purged + 1; end if;
    end if;
  end loop;
  return jsonb_build_object('kind','completed','stagedPartsPurged',purged,
    'committedMarkersCleared',finalized);
end;
$$;
revoke all on function public.account_plan_part_is_currently_referenced(uuid,text,text),
  public.reap_expired_account_plan_staging(uuid),
  public.track_account_plan_staging(), public.guard_account_plan_staging_reference(),
  public.finalize_account_plan_staging(),
  public.recycle_expired_account_plan_stage(uuid,text,text,text,text,jsonb),
  public.run_account_plan_staging_retention_batch()
  from public, anon, authenticated, service_role;

commit;
