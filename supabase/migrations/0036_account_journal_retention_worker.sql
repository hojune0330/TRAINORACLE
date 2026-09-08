-- Maintenance implementation only. Scheduling is a separate operator action.
begin;
create function public.run_account_journal_retention_batch()
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  target uuid;
  cutoff timestamptz := clock_timestamp();
  removed bigint := 0;
  cleared bigint := 0;
  affected bigint;
  owners integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('account_journal_retention_worker', 0)) then
    return jsonb_build_object('kind','already_running');
  end if;
  for target in
    select candidate.user_id from (
      select h.user_id from public.account_journal_history h where h.expires_at <= cutoff
      union
      select o.user_id from public.account_journal_operations o
        where o.payload_expires_at <= cutoff and o.result->>'kind' = 'saved'
          and o.proposed_encrypted_payload is not null
    ) candidate order by candidate.user_id limit 200
  loop
    if not pg_try_advisory_xact_lock(hashtextextended('account_journal_v2:' || target::text, 0)) then
      continue;
    end if;
    delete from public.account_journal_history h where h.user_id = target and h.expires_at <= cutoff;
    get diagnostics affected = row_count;
    removed := removed + affected;
    update public.account_journal_operations o set proposed_encrypted_payload = null
      where o.user_id = target and o.payload_expires_at <= cutoff
        and o.result->>'kind' = 'saved' and o.proposed_encrypted_payload is not null;
    get diagnostics affected = row_count;
    cleared := cleared + affected;
    owners := owners + 1;
  end loop;
  -- Aggregate counts only: no owners, document identifiers, ciphertext or keys.
  return jsonb_build_object('kind','completed','ownersProcessed',owners,
    'historyPurged',removed,'operationPayloadsPurged',cleared);
end;
$$;
revoke all on function public.run_account_journal_retention_batch() from public, anon, authenticated, service_role;
commit;
