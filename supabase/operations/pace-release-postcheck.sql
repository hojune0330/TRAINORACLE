begin read only;
select 'pace_helper_private' as check_id,
  p.prosecdef and p.proconfig @> array['search_path=pg_catalog']
  and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE') as passed
from pg_proc p where p.oid='public.verify_account_pace_record_revision(uuid,jsonb)'::regprocedure
union all
select 'journal_capability_and_revision',
  position('athleteRecordSupport' in pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure))>0
  and position('verify_account_pace_record_revision' in pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure))>0
union all
select 'replan_revision_guard', position('paceRecordGuard' in pg_get_functiondef('public.mutate_account_plan_replan_attested(text,text,text)'::regprocedure))>0
union all
select 'canonical_half_exception', position('<> 21097.5' in pg_get_functiondef('public.oracle_comparison_snapshot_is_safe(jsonb)'::regprocedure))>0;
rollback;
