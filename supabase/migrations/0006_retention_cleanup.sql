create or replace function public.purge_expired_beta_data()
returns table (analytics_deleted bigint, accounts_deleted bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  analytics_count bigint;
  account_count bigint;
begin
  delete from public.product_analytics_events
  where expires_at <= now();
  get diagnostics analytics_count = row_count;

  delete from auth.users
  where id in (
    select request.user_id
    from public.account_deletion_requests request
    where request.delete_by <= now()
      and request.status <> 'DELETED'
  );
  get diagnostics account_count = row_count;

  return query select analytics_count, account_count;
end;
$$;

revoke all on function public.purge_expired_beta_data() from public;
revoke all on function public.purge_expired_beta_data() from anon;
revoke all on function public.purge_expired_beta_data() from authenticated;
grant execute on function public.purge_expired_beta_data() to service_role;
