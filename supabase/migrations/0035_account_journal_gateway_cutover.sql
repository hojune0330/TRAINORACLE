-- Gateway trust boundary only. No feature activation, key provisioning or credit.
begin;
create extension if not exists pgcrypto with schema extensions;

create table public.account_journal_gateway_keys (
  key_id text primary key check (length(key_id) between 1 and 80),
  secret bytea not null check (octet_length(secret) = 32),
  enabled boolean not null default true
);
revoke all on public.account_journal_gateway_keys from public, anon, authenticated, service_role;
alter table public.account_journal_gateway_keys enable row level security;

-- Immutable identity facts are separate from encrypted versions. No raw text.
create table public.account_journal_identity (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  document_kind text not null,
  occurrence_id text,
  journal_date date,
  award_allowed boolean not null default false,
  active boolean not null,
  primary key(user_id, document_id)
);
alter table public.account_journal_operations add column trusted_metadata jsonb;
create unique index account_journal_occurrence_unique on public.account_journal_identity(user_id, occurrence_id)
  where active and occurrence_id is not null;
-- Transactional outbox, NOT a points balance. A decoration consumer must resolve
-- trusted new-record versus migration origin before credit. Restore is not credit.
create table public.account_journal_finalization_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  journal_date date not null,
  eligible boolean not null,
  status text not null default 'RECORDED' check (status = 'RECORDED'),
  primary key(user_id, document_id)
);
alter table public.account_journal_identity enable row level security;
alter table public.account_journal_finalization_events enable row level security;
revoke all on public.account_journal_identity, public.account_journal_finalization_events
  from public, anon, authenticated, service_role;

-- Sticky per-owner cutover prevents flag-OFF incident containment reopening writes.
create table public.account_journal_cutovers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.account_journal_cutovers enable row level security;
revoke all on public.account_journal_cutovers from public, anon, authenticated, service_role;
create table public.account_reward_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_date date not null,
  source text not null check (source in ('JOURNAL','VISIT')),
  primary key(user_id,reward_date,source)
);
create table public.account_decoration_purchases (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  cost integer not null check (cost > 0),
  primary key(user_id,item_id)
);
alter table public.account_reward_days enable row level security;
-- Owner-confirmed self-import is not verified purchase evidence or earned credit.
create table public.account_decoration_legacy_window (
  singleton boolean primary key default true check (singleton),
  cutover_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > cutover_at)
);
insert into public.account_decoration_legacy_window values(true,transaction_timestamp(),transaction_timestamp()+interval '30 days');
alter table public.account_decoration_legacy_window enable row level security;
revoke all on public.account_decoration_legacy_window from public,anon,authenticated,service_role;
create table public.account_decoration_legacy_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document_id uuid not null,
  operation_id uuid not null,
  provenance text not null default 'LEGACY_INITIAL_GRANT' check (provenance='LEGACY_INITIAL_GRANT'),
  verification text not null default 'UNVERIFIED_LEGACY' check (verification='UNVERIFIED_LEGACY'),
  items jsonb not null check (jsonb_typeof(items)='array'),
  spent_points bigint not null check (spent_points >= 0)
);
alter table public.account_decoration_legacy_grants enable row level security;
revoke all on public.account_decoration_legacy_grants from public,anon,authenticated,service_role;
alter table public.account_decoration_purchases enable row level security;
revoke all on public.account_reward_days, public.account_decoration_purchases from public, anon, authenticated, service_role;

create function public.account_reward_summary()
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := public.account_journal_lifecycle_owner(); today date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  journals bigint; visits bigint; spent bigint;
begin
  select count(*) filter(where r.source='JOURNAL'), count(*) filter(where r.source='VISIT')
    into journals,visits from public.account_reward_days r where r.user_id=owner_id;
  select coalesce(sum(p.cost),0) into spent from public.account_decoration_purchases p where p.user_id=owner_id;
  return jsonb_build_object('kind','rewardSummary','ownerId',owner_id,'today',today,
    'points',journals*4+visits,'spentPoints',spent,'availablePoints',journals*4+visits-spent,
    'legacySpentPoints',coalesce((select g.spent_points from public.account_decoration_legacy_grants g where g.user_id=owner_id),0),
    'journalDays',journals,'visitDays',visits,
    'journalRecordedToday',exists(select 1 from public.account_reward_days r where r.user_id=owner_id and r.reward_date=today and r.source='JOURNAL'),
    'visitedToday',exists(select 1 from public.account_reward_days r where r.user_id=owner_id and r.reward_date=today and r.source='VISIT'));
end;
$$;
create function public.record_account_reward_visit()
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid := public.account_journal_lifecycle_owner(); awarded integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  insert into public.account_reward_days values(owner_id,(clock_timestamp() at time zone 'Asia/Seoul')::date,'VISIT')
    on conflict do nothing;
  get diagnostics awarded = row_count;
  return jsonb_build_object('kind','visit','awardedPoints',awarded,'summary',public.account_reward_summary());
end;
$$;
revoke all on function public.account_reward_summary(), public.record_account_reward_visit() from public,anon,authenticated,service_role;
grant execute on function public.account_reward_summary(), public.record_account_reward_visit() to authenticated;
create function public.guard_legacy_account_journal_write()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare owner_id uuid;
begin
  if tg_op = 'DELETE' then owner_id := old.user_id; else owner_id := new.user_id; end if;
  -- Account deletion cascades must remain possible; no identity is a migration/admin operation.
  if auth.uid() is not null and exists(select 1 from auth.users u where u.id=owner_id)
    and (public.service_feature_enabled('ACCOUNT_JOURNAL_V2')
    or exists(select 1 from public.account_journal_cutovers c where c.user_id = owner_id)) then
    raise exception 'ACCOUNT_JOURNAL_LEGACY_WRITE_DENIED' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_legacy_account_journal_write() from public, anon, authenticated, service_role;
create trigger account_journal_cutover_guard before insert or update or delete on public.journal_entries
  for each row execute function public.guard_legacy_account_journal_write();
create trigger account_journal_tombstone_cutover_guard before insert or update or delete on public.journal_tombstones
  for each row execute function public.guard_legacy_account_journal_write();
-- TRUNCATE ignores RLS and row triggers; API roles never need this capability.
revoke truncate on public.journal_entries, public.journal_tombstones from public, anon, authenticated;

-- Old signatures must not remain a bypass around the attested wrapper.
revoke all on function public.commit_account_journal_document(uuid,uuid,bigint,jsonb),
  public.delete_account_journal_document(uuid,uuid,bigint),
  public.restore_account_journal_document(uuid,uuid,bigint,bigint)
  from public, anon, authenticated, service_role;

create function public.mutate_account_journal_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  owner_id uuid := public.account_journal_lifecycle_owner();
  signing_key bytea;
  request jsonb;
  metadata jsonb;
  doc uuid;
  op uuid;
  expected bigint;
  action text;
  source bigint;
  receipt jsonb;
  identity_row public.account_journal_identity%rowtype;
  document_kind text;
  occurrence text;
  record_date date;
  purchase jsonb;
  total_spent bigint;
  earned bigint;
  prior_metadata jsonb;
  legacy_grant public.account_decoration_legacy_grants%rowtype;
begin
  if request_text is null or octet_length(request_text) > 1600000
    or signature is null or signature !~ '^[a-f0-9]{64}$' then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode = '42501';
  end if;
  select k.secret into signing_key from public.account_journal_gateway_keys k
    where k.key_id = $3 and k.enabled;
  if signing_key is null or extensions.hmac(convert_to(request_text,'UTF8'), signing_key, 'sha256')
    <> decode(signature,'hex') then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode = '42501';
  end if;
  request := request_text::jsonb;
  if request->>'domain' is distinct from 'trainoracle.account-journal.gateway.v1'
    or request->>'ownerId' is distinct from owner_id::text
    or (request->>'expiresAt')::bigint is null
    or (request->>'expiresAt')::bigint < extract(epoch from clock_timestamp())
    or (request->>'expiresAt')::bigint > extract(epoch from clock_timestamp()) + 120 then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode = '42501';
  end if;
  doc := (request->>'documentId')::uuid; op := (request->>'operationId')::uuid;
  expected := (request->>'expectedRevision')::bigint;
  action := request->>'action'; source := (request->>'sourceRevision')::bigint;
  if action = 'status' then return jsonb_build_object('kind','ready'); end if;
  if action is null or action not in ('commit','delete','restore') then
    raise exception 'INVALID_ACCOUNT_JOURNAL_REQUEST' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text, 0));
  select i.* into identity_row from public.account_journal_identity i
    where i.user_id = owner_id and i.document_id = doc;
  metadata := request->'metadata';
  select o.trusted_metadata into prior_metadata from public.account_journal_operations o
    where o.user_id=owner_id and o.operation_id=op;
  if prior_metadata is not null and prior_metadata is distinct from metadata then
    raise exception 'ACCOUNT_JOURNAL_OPERATION_REUSED' using errcode = '22023';
  end if;
  if action <> 'delete' then
    if metadata is null or jsonb_typeof(metadata) <> 'object'
      or not metadata ?& array['kind','occurrenceId','journalDate','eligible']
      or metadata - array['kind','occurrenceId','journalDate','eligible','purchases','spentPoints','awardAllowed','legacyInitialGrant'] <> '{}'::jsonb
      or jsonb_typeof(metadata->'eligible') <> 'boolean' then
      raise exception 'INVALID_ACCOUNT_JOURNAL_METADATA' using errcode = '22023';
    end if;
    document_kind := metadata->>'kind'; occurrence := metadata->>'occurrenceId';
    record_date := (metadata->>'journalDate')::date;
    if document_kind is null or document_kind not in ('DRAFT','JOURNAL','DECORATIONS','PLAN')
      or (occurrence is not null and occurrence !~ '^sha256:[a-f0-9]{64}$')
      or (document_kind = 'JOURNAL' and record_date is null)
      or (document_kind <> 'JOURNAL' and (occurrence is not null or record_date is not null or (metadata->>'eligible')::boolean)) then
      raise exception 'INVALID_ACCOUNT_JOURNAL_METADATA' using errcode = '22023';
    end if;
    if identity_row.document_id is not null and (identity_row.document_kind is distinct from document_kind
      or identity_row.occurrence_id is distinct from occurrence or identity_row.journal_date is distinct from record_date) then
      raise exception 'ACCOUNT_JOURNAL_IDENTITY_CHANGED' using errcode = '22023';
    end if;
  end if;
  if document_kind = 'JOURNAL' and expected = 0 and exists (
    select 1 from public.account_journal_documents d where d.user_id=owner_id and d.deleted_at is null
      and not exists(select 1 from public.account_journal_identity i where i.user_id=d.user_id and i.document_id=d.document_id)
  ) then
    raise exception 'ACCOUNT_JOURNAL_RECONCILIATION_REQUIRED' using errcode = '42501';
  end if;
  receipt := public.mutate_account_journal_lifecycle(doc,op,expected,
    case when action = 'commit' then request->'encryptedPayload' else null end,action,source);
  if receipt->>'kind' in ('saved','restored','deleted') then
    -- A replay does not rewind active identity or create eligibility events.
    if exists(select 1 from public.account_journal_documents d where d.user_id = owner_id
      and d.document_id = doc and d.revision = (receipt->>'revision')::bigint) then
      if action = 'delete' then
        update public.account_journal_identity i set active = false where i.user_id = owner_id and i.document_id = doc;
      else
        insert into public.account_journal_identity(user_id,document_id,document_kind,occurrence_id,journal_date,active,award_allowed)
          values(owner_id,doc,document_kind,occurrence,record_date,true,
            coalesce(action='commit' and expected=0 and metadata->>'awardAllowed'='true',false))
        on conflict(user_id,document_id) do update set active = true;
        if document_kind = 'JOURNAL' and action = 'commit' then
          insert into public.account_journal_finalization_events(user_id,document_id,journal_date,eligible)
            values(owner_id,doc,record_date,(metadata->>'eligible')::boolean)
          on conflict(user_id,document_id) do update set eligible = public.account_journal_finalization_events.eligible or excluded.eligible;
          -- No reward from restore, old dates, memo-only saves or migration requests.
          if (metadata->>'eligible')::boolean and metadata->>'awardAllowed' = 'true'
            and exists(select 1 from public.account_journal_identity i where i.user_id=owner_id and i.document_id=doc and i.award_allowed)
            and record_date = (clock_timestamp() at time zone 'Asia/Seoul')::date then
            insert into public.account_reward_days values(owner_id,record_date,'JOURNAL') on conflict do nothing;
          end if;
        end if;
        if document_kind = 'DECORATIONS' then
          if jsonb_typeof(metadata->'purchases') is distinct from 'array'
            or jsonb_typeof(metadata->'spentPoints') is distinct from 'number' then
            raise exception 'INVALID_DECORATION_PURCHASE' using errcode = '22023';
          end if;
          -- Catalog IDs/costs are derived from the compiled server catalog and
          select g.* into legacy_grant from public.account_decoration_legacy_grants g where g.user_id=owner_id;
          if metadata->>'legacyInitialGrant' = 'true' then
            -- Retries of an already accepted operation do not reopen the window.
            if legacy_grant.user_id is null and (not exists(
              select 1 from public.account_decoration_legacy_window w join auth.users u on u.id=owner_id
              where u.created_at < w.cutover_at and clock_timestamp() < w.expires_at)
              or jsonb_array_length(metadata->'purchases') > 128
              or (select count(distinct item->>'itemId') from jsonb_array_elements(metadata->'purchases') item)
                <> jsonb_array_length(metadata->'purchases')) then
              raise exception 'LEGACY_INITIAL_GRANT_INELIGIBLE' using errcode='42501';
            end if;
            if action <> 'commit' or expected <> 0
              or (identity_row.document_id is not null and prior_metadata is null)
              or exists(select 1 from public.account_decoration_purchases p where p.user_id=owner_id)
              or (legacy_grant.user_id is not null and (legacy_grant.operation_id <> op
                or legacy_grant.document_id <> doc or legacy_grant.items <> metadata->'purchases'
                or legacy_grant.spent_points <> (metadata->>'spentPoints')::bigint)) then
              raise exception 'LEGACY_INITIAL_GRANT_ALREADY_USED' using errcode='22023';
            end if;
            insert into public.account_decoration_legacy_grants(user_id,document_id,operation_id,items,spent_points)
              values(owner_id,doc,op,metadata->'purchases',(metadata->>'spentPoints')::bigint) on conflict do nothing;
            select g.* into legacy_grant from public.account_decoration_legacy_grants g where g.user_id=owner_id;
          end if;
          -- signed with the exact encrypted state, never separately client claims.
          for purchase in select value from jsonb_array_elements(metadata->'purchases') loop
            if jsonb_typeof(purchase->'itemId') is distinct from 'string'
              or (purchase->>'cost')::integer is null or (purchase->>'cost')::integer <= 0 then
              raise exception 'INVALID_DECORATION_PURCHASE' using errcode = '22023';
            end if;
            if action = 'restore' and not exists(select 1 from public.account_decoration_purchases p
              where p.user_id=owner_id and p.item_id=purchase->>'itemId')
              and not exists(select 1 from jsonb_array_elements(coalesce(legacy_grant.items,'[]'::jsonb)) item
                where item->>'itemId'=purchase->>'itemId') then
              raise exception 'DECORATION_RESTORE_PURCHASE_DENIED' using errcode = '22023';
            end if;
            if exists(select 1 from jsonb_array_elements(coalesce(legacy_grant.items,'[]'::jsonb)) item
              where item->>'itemId'=purchase->>'itemId') then continue; end if;
            insert into public.account_decoration_purchases values(owner_id,purchase->>'itemId',(purchase->>'cost')::integer)
              on conflict do nothing;
          end loop;
          select coalesce(sum(p.cost),0) into total_spent from public.account_decoration_purchases p where p.user_id=owner_id;
          select coalesce(sum(case r.source when 'JOURNAL' then 4 else 1 end),0) into earned
            from public.account_reward_days r where r.user_id=owner_id;
          if total_spent > earned then
            raise exception 'ACCOUNT_REWARD_INSUFFICIENT_POINTS' using errcode = 'P0001';
          end if;
          if total_spent + coalesce(legacy_grant.spent_points,0) <> (metadata->>'spentPoints')::bigint then
            raise exception 'INVALID_DECORATION_PURCHASE' using errcode = '22023';
          end if;
          if exists(select 1 from public.account_decoration_purchases p where p.user_id=owner_id
            and not exists(select 1 from jsonb_array_elements(metadata->'purchases') item where item->>'itemId'=p.item_id)) then
            raise exception 'DECORATION_OWNERSHIP_REMOVAL_DENIED' using errcode = '22023';
          end if;
          if exists(select 1 from jsonb_array_elements(coalesce(legacy_grant.items,'[]'::jsonb)) legacy
            where not exists(select 1 from jsonb_array_elements(metadata->'purchases') item
              where item->>'itemId'=legacy->>'itemId')) then
            raise exception 'LEGACY_OWNERSHIP_REMOVAL_DENIED' using errcode='22023';
          end if;
        end if;
      end if;
    end if;
    insert into public.account_journal_cutovers values(owner_id) on conflict do nothing;
  end if;
  update public.account_journal_operations o set trusted_metadata=metadata
    where o.user_id=owner_id and o.operation_id=op and o.trusted_metadata is null;
  return receipt;
end;
$$;
revoke all on function public.mutate_account_journal_attested(text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.mutate_account_journal_attested(text,text,text) to authenticated;
commit;
