revoke insert on table public.user_private_profiles from authenticated;
grant insert (user_id, birth_date) on table public.user_private_profiles to authenticated;
revoke update on table public.user_private_profiles from authenticated;
grant update (birth_date) on table public.user_private_profiles to authenticated;

create or replace function public.set_product_analytics_consent(enabled_input boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.account_network_access_allowed(auth.uid()) then
    return false;
  end if;

  update public.user_private_profiles
  set analytics_opt_in = enabled_input,
      updated_at = clock_timestamp()
  where user_id = auth.uid()
    and deletion_requested_at is null;
  if not found then
    return false;
  end if;

  if not enabled_input then
    delete from public.product_analytics_events
    where user_id = auth.uid();
  end if;
  return true;
end;
$$;

revoke all on function public.set_product_analytics_consent(boolean) from public;
revoke all on function public.set_product_analytics_consent(boolean) from anon;
revoke all on function public.set_product_analytics_consent(boolean) from authenticated;
grant execute on function public.set_product_analytics_consent(boolean) to authenticated;

create or replace function public.record_product_analytics_event(event_name_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  occurred timestamptz;
  opted_in boolean;
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

  select profile.analytics_opt_in
  into opted_in
  from public.user_private_profiles profile
  where profile.user_id = auth.uid()
    and profile.deletion_requested_at is null
  for update;
  if not coalesce(opted_in, false) then
    return false;
  end if;

  occurred := clock_timestamp();
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
revoke all on function public.record_product_analytics_event(text) from anon;
revoke all on function public.record_product_analytics_event(text) from authenticated;
grant execute on function public.record_product_analytics_event(text) to authenticated;
