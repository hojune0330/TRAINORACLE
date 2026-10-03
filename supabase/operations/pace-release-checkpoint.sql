-- Catalog definitions only. Never queries athlete documents or gateway key tables.
begin read only;
select p.oid::regprocedure::text as signature,
  pg_get_userbyid(p.proowner) as owner,
  p.proacl::text as acl, p.prosecdef as security_definer, p.proconfig as configuration,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.oid in (
  'public.mutate_account_journal_attested(text,text,text)'::regprocedure,
  'public.mutate_account_plan_replan_attested(text,text,text)'::regprocedure,
  'public.oracle_comparison_snapshot_is_safe(jsonb)'::regprocedure
)
order by p.oid::regprocedure::text;
rollback;
