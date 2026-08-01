revoke insert on table public.product_analytics_events from anon;
revoke insert on table public.product_analytics_events from authenticated;

create or replace function public.record_product_analytics_event(event_name_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  occurred timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if event_name_input not in (
    'APP_OPENED',
    'JOURNAL_STARTED',
    'JOURNAL_SAVED',
    'ARCHIVE_OPENED',
    'PLAN_PROPOSAL_REVIEWED',
    'SYNC_SUCCEEDED',
    'SYNC_FAILED'
  ) then
    raise exception 'unsupported analytics event';
  end if;
  if not public.account_network_access_allowed(auth.uid()) then
    return false;
  end if;
  if not exists (
    select 1
    from public.user_private_profiles profile
    where profile.user_id = auth.uid()
      and profile.analytics_opt_in
      and profile.deletion_requested_at is null
  ) then
    return false;
  end if;

  insert into public.product_analytics_events (
    user_id,
    event_name,
    occurred_at,
    expires_at
  ) values (
    auth.uid(),
    event_name_input,
    occurred,
    occurred + interval '30 days'
  );
  return true;
end;
$$;

revoke all on function public.record_product_analytics_event(text) from public;
grant execute on function public.record_product_analytics_event(text) to authenticated;
