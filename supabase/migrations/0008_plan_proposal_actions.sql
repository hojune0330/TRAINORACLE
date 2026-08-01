drop policy if exists "proposal participant insert" on public.plan_proposals;

create or replace function public.can_create_plan_proposal(target_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.athlete_support_access_allowed(target_athlete)
    and (
      auth.uid() = target_athlete
      or exists (
        select 1
        from public.support_connections connection
        where connection.athlete_id = target_athlete
          and connection.supporter_id = auth.uid()
          and connection.revoked_at is null
          and connection.season_ends_on >= current_date
      )
    );
$$;

revoke all on function public.can_create_plan_proposal(uuid) from public;
grant execute on function public.can_create_plan_proposal(uuid) to authenticated;

create policy "proposal participant draft insert" on public.plan_proposals
  for insert with check (
    public.can_create_plan_proposal(athlete_id)
    and proposed_by = auth.uid()
    and status = 'DRAFT'
    and first_warning_reviewed_at is null
    and warning_acknowledged_at is null
  );

revoke update on table public.plan_proposals from anon;
revoke update on table public.plan_proposals from authenticated;

create or replace function public.review_plan_proposal(proposal_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.plan_proposals%rowtype;
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into proposal
  from public.plan_proposals
  where id = proposal_id
  for update;

  if proposal.id is null then
    raise exception 'proposal not found';
  end if;
  if proposal.athlete_id <> auth.uid() then
    raise exception 'only the athlete can review this proposal';
  end if;
  if not public.athlete_support_access_allowed(proposal.athlete_id) then
    raise exception 'athlete network access is blocked';
  end if;

  if proposal.status = 'DRAFT' and proposal.warning_reason is null then
    update public.plan_proposals
    set status = 'ACTIVE', updated_at = clock_timestamp()
    where id = proposal.id;
    next_status := 'ACTIVE';
  elsif proposal.status = 'DRAFT' and proposal.warning_reason is not null then
    update public.plan_proposals
    set status = 'WARNING_REVIEWED',
        first_warning_reviewed_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where id = proposal.id;
    next_status := 'WARNING_REVIEWED';
  elsif proposal.status = 'WARNING_REVIEWED' then
    update public.plan_proposals
    set status = 'USER_ACCEPTED_WITH_WARNING',
        warning_acknowledged_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where id = proposal.id;
    next_status := 'USER_ACCEPTED_WITH_WARNING';
  else
    next_status := proposal.status;
  end if;

  return next_status;
end;
$$;

revoke all on function public.review_plan_proposal(uuid) from public;
grant execute on function public.review_plan_proposal(uuid) to authenticated;
