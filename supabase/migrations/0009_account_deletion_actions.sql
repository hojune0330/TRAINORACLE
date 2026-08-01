revoke insert on table public.account_deletion_requests from anon;
revoke insert on table public.account_deletion_requests from authenticated;

create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  requested timestamptz := clock_timestamp();
  recorded timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.account_deletion_requests (
    user_id,
    requested_at,
    access_blocked_at,
    delete_by,
    status
  ) values (
    auth.uid(),
    requested,
    requested,
    requested + interval '30 days',
    'REQUESTED'
  )
  on conflict (user_id) do nothing;

  select request.requested_at into recorded
  from public.account_deletion_requests request
  where request.user_id = auth.uid();

  return recorded;
end;
$$;

revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;

create or replace function public.can_access_shared_athlete_data(target_athlete uuid)
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

revoke all on function public.can_access_shared_athlete_data(uuid) from public;
grant execute on function public.can_access_shared_athlete_data(uuid) to authenticated;

drop policy if exists "journal owner or active supporter select" on public.journal_entries;
create policy "journal owner or active supporter select" on public.journal_entries
  for select using (public.can_access_shared_athlete_data(user_id));

drop policy if exists "connection participants select" on public.support_connections;
create policy "connection participants select" on public.support_connections
  for select using (
    auth.uid() in (athlete_id, supporter_id)
    and public.can_access_shared_athlete_data(athlete_id)
  );

drop policy if exists "proposal participants select" on public.plan_proposals;
create policy "proposal participants select" on public.plan_proposals
  for select using (
    auth.uid() in (athlete_id, proposed_by)
    and public.can_access_shared_athlete_data(athlete_id)
  );
