create table if not exists public.plan_safety_snapshots (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  state text not null check (state in ('CURRENT', 'STALE', 'BLOCKED')),
  captured_at timestamptz not null default clock_timestamp(),
  valid_until timestamptz not null,
  revoked_at timestamptz,
  pipeline_ref text not null,
  check (valid_until > captured_at)
);

alter table public.plan_safety_snapshots enable row level security;
revoke all on table public.plan_safety_snapshots from anon;
revoke all on table public.plan_safety_snapshots from authenticated;

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  revision integer not null check (revision > 0),
  source_proposal_id uuid not null unique references public.plan_proposals (id) on delete restrict,
  plan_payload jsonb not null,
  activated_by uuid not null references auth.users (id) on delete restrict,
  activated_at timestamptz not null default clock_timestamp(),
  unique (athlete_id, revision)
);

create table if not exists public.athlete_active_plans (
  athlete_id uuid primary key references auth.users (id) on delete cascade,
  active_plan_version_id uuid references public.plan_versions (id) on delete restrict,
  active_revision integer not null default 0 check (active_revision >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.plan_activation_receipts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  proposal_id uuid not null unique references public.plan_proposals (id) on delete restrict,
  plan_version_id uuid not null unique references public.plan_versions (id) on delete restrict,
  active_revision integer not null check (active_revision > 0),
  activated_by uuid not null references auth.users (id) on delete restrict,
  warning_reviewed_at timestamptz,
  warning_review_reason text,
  warning_acknowledged_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.plan_versions enable row level security;
alter table public.athlete_active_plans enable row level security;
alter table public.plan_activation_receipts enable row level security;
revoke all on table public.plan_versions from anon;
revoke all on table public.plan_versions from authenticated;
revoke all on table public.athlete_active_plans from anon;
revoke all on table public.athlete_active_plans from authenticated;
revoke all on table public.plan_activation_receipts from anon;
revoke all on table public.plan_activation_receipts from authenticated;

create or replace function public.reject_plan_version_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using errcode = 'P0001', message = 'IMMUTABLE_PLAN_VERSION';
end;
$$;

drop trigger if exists plan_versions_immutable on public.plan_versions;
create trigger plan_versions_immutable
before update or delete on public.plan_versions
for each row execute function public.reject_plan_version_mutation();

alter table public.plan_proposals
  add column if not exists base_active_revision integer,
  add column if not exists expires_at timestamptz,
  add column if not exists safety_snapshot_id uuid references public.plan_safety_snapshots (id) on delete restrict,
  add column if not exists warning_review_reason text,
  add column if not exists warning_reviewed_by uuid references auth.users (id) on delete restrict,
  add column if not exists warning_acknowledged_by uuid references auth.users (id) on delete restrict;

alter table public.plan_proposals
  drop constraint if exists plan_proposals_status_check;
alter table public.plan_proposals
  add constraint plan_proposals_status_check check (status in (
    'DRAFT', 'WARNING_REVIEWED', 'ACTIVE', 'USER_ACCEPTED_WITH_WARNING', 'REJECTED', 'SUPERSEDED'
  ));

drop policy if exists "proposal participant draft insert" on public.plan_proposals;
create policy "proposal participant bounded draft insert" on public.plan_proposals
  for insert with check (
    public.can_create_plan_proposal(athlete_id)
    and proposed_by = auth.uid()
    and status = 'DRAFT'
    and base_active_revision is not null
    and expires_at is not null
    and safety_snapshot_id is not null
    and first_warning_reviewed_at is null
    and warning_acknowledged_at is null
    and warning_review_reason is null
    and warning_reviewed_by is null
    and warning_acknowledged_by is null
  );

drop function if exists public.review_plan_proposal(uuid);

create or replace function public.record_plan_proposal_warning_review(
  proposal_id uuid,
  review_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.plan_proposals%rowtype;
  recorded_at timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if length(trim(coalesce(review_reason, ''))) = 0 or length(trim(review_reason)) > 500 then
    raise exception using errcode = 'P0001', message = 'WARNING_REVIEW_REASON_REQUIRED';
  end if;

  select * into proposal
  from public.plan_proposals
  where id = proposal_id
  for update;

  if proposal.id is null then
    raise exception using errcode = 'P0001', message = 'PLAN_PROPOSAL_NOT_FOUND';
  end if;
  if proposal.athlete_id <> auth.uid() or not public.athlete_support_access_allowed(proposal.athlete_id) then
    raise exception using errcode = 'P0001', message = 'PLAN_PROPOSAL_ACCESS_DENIED';
  end if;
  if proposal.warning_reason is null or proposal.status <> 'DRAFT' then
    raise exception using errcode = 'P0001', message = 'WARNING_REVIEW_NOT_AVAILABLE';
  end if;

  update public.plan_proposals
  set status = 'WARNING_REVIEWED',
      first_warning_reviewed_at = recorded_at,
      warning_review_reason = trim(review_reason),
      warning_reviewed_by = auth.uid(),
      updated_at = recorded_at
  where id = proposal.id
    and status = 'DRAFT';

  if not found then
    raise exception using errcode = 'P0001', message = 'PLAN_PROPOSAL_REVIEW_CONFLICT';
  end if;

  return jsonb_build_object(
    'outcome', 'WARNING_RECORDED',
    'proposalId', proposal.id,
    'reviewedAt', recorded_at
  );
end;
$$;

create or replace function public.activate_plan_proposal(proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.plan_proposals%rowtype;
  safety_snapshot public.plan_safety_snapshots%rowtype;
  active_plan public.athlete_active_plans%rowtype;
  version_id uuid := gen_random_uuid();
  activated_at timestamptz := clock_timestamp();
  next_status text;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select * into proposal
  from public.plan_proposals
  where id = proposal_id
  for update;

  if proposal.id is null then
    raise exception using errcode = 'P0001', message = 'PLAN_PROPOSAL_NOT_FOUND';
  end if;
  if proposal.athlete_id <> auth.uid() or not public.athlete_support_access_allowed(proposal.athlete_id) then
    raise exception using errcode = 'P0001', message = 'PLAN_PROPOSAL_ACCESS_DENIED';
  end if;
  if proposal.expires_at is null or proposal.expires_at <= activated_at then
    raise exception using errcode = 'P0001', message = 'PLAN_PROPOSAL_EXPIRED';
  end if;
  if proposal.safety_snapshot_id is null then
    raise exception using errcode = 'P0001', message = 'SAFETY_SNAPSHOT_MISSING';
  end if;

  select * into safety_snapshot
  from public.plan_safety_snapshots
  where id = proposal.safety_snapshot_id
  for update;

  if safety_snapshot.id is null
    or safety_snapshot.athlete_id <> proposal.athlete_id
    or safety_snapshot.state <> 'CURRENT'
    or safety_snapshot.revoked_at is not null
    or safety_snapshot.valid_until <= activated_at then
    raise exception using errcode = 'P0001', message = 'STALE_SAFETY_SNAPSHOT';
  end if;

  if proposal.warning_reason is null and proposal.status = 'DRAFT' then
    next_status := 'ACTIVE';
  elsif proposal.warning_reason is not null
    and proposal.status = 'WARNING_REVIEWED'
    and proposal.first_warning_reviewed_at is not null
    and proposal.warning_reviewed_by = auth.uid()
    and proposal.warning_review_reason is not null then
    next_status := 'USER_ACCEPTED_WITH_WARNING';
  else
    raise exception using errcode = 'P0001', message = 'PLAN_PROPOSAL_REVIEW_REQUIRED';
  end if;

  insert into public.athlete_active_plans (athlete_id, active_revision, updated_at)
  values (proposal.athlete_id, 0, activated_at)
  on conflict (athlete_id) do nothing;

  select * into active_plan
  from public.athlete_active_plans
  where athlete_id = proposal.athlete_id
  for update;

  if proposal.base_active_revision is null or proposal.base_active_revision <> active_plan.active_revision then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  insert into public.plan_versions (
    id, athlete_id, revision, source_proposal_id, plan_payload, activated_by, activated_at
  ) values (
    version_id, proposal.athlete_id, active_plan.active_revision + 1, proposal.id,
    proposal.proposal_payload, auth.uid(), activated_at
  );

  update public.athlete_active_plans
  set active_plan_version_id = version_id,
      active_revision = active_plan.active_revision + 1,
      updated_at = activated_at
  where athlete_id = proposal.athlete_id
    and active_revision = proposal.base_active_revision;

  if not found then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  update public.plan_proposals
  set status = next_status,
      warning_acknowledged_at = case when next_status = 'USER_ACCEPTED_WITH_WARNING' then activated_at else null end,
      warning_acknowledged_by = case when next_status = 'USER_ACCEPTED_WITH_WARNING' then auth.uid() else null end,
      updated_at = activated_at
  where id = proposal.id;

  update public.plan_proposals
  set status = 'SUPERSEDED', updated_at = activated_at
  where athlete_id = proposal.athlete_id
    and id <> proposal.id
    and status in ('DRAFT', 'WARNING_REVIEWED');

  insert into public.plan_activation_receipts (
    athlete_id, proposal_id, plan_version_id, active_revision, activated_by,
    warning_reviewed_at, warning_review_reason, warning_acknowledged_at, created_at
  ) values (
    proposal.athlete_id, proposal.id, version_id, active_plan.active_revision + 1, auth.uid(),
    proposal.first_warning_reviewed_at, proposal.warning_review_reason,
    case when next_status = 'USER_ACCEPTED_WITH_WARNING' then activated_at else null end,
    activated_at
  );

  return jsonb_build_object(
    'outcome', 'ACTIVATED',
    'proposalId', proposal.id,
    'planVersionId', version_id,
    'activeRevision', active_plan.active_revision + 1,
    'activatedAt', activated_at
  );
end;
$$;

revoke all on function public.record_plan_proposal_warning_review(uuid, text) from public;
revoke all on function public.activate_plan_proposal(uuid) from public;
grant execute on function public.record_plan_proposal_warning_review(uuid, text) to authenticated;
grant execute on function public.activate_plan_proposal(uuid) to authenticated;
