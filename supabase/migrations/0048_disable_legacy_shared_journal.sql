-- The account vault permits owner recovery, not in-app recipient access to raw notes.
-- Keep the old RPC signature for installed callers, but fail closed even if older
-- ACCOUNT/SYNC/SHARING controls or support connections are later enabled.
begin;

create or replace function public.list_shared_journal_entries(target_athlete uuid)
returns table (entry_id text, saved_at text, shared_entry jsonb)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'LEGACY_SHARED_JOURNAL_DISABLED' using errcode = '42501';
end;
$$;

revoke all on function public.list_shared_journal_entries(uuid)
  from public, anon, authenticated, service_role;

commit;
