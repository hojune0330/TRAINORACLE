-- Metadata only. No athlete rows, credentials, or application settings are changed.
begin read only;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid = 'public.saved_training_plans'::regclass
order by conname;

select relrowsecurity from pg_class where oid = 'public.saved_training_plans'::regclass;
select policyname, roles, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'saved_training_plans' order by policyname;
select tgname, pg_get_triggerdef(oid) as definition from pg_trigger
where tgrelid = 'public.saved_training_plans'::regclass and not tgisinternal;
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'saved_training_plans' order by grantee, privilege_type;
select public.service_feature_enabled('PLAN_BACKUP') as plan_backup_enabled,
  has_table_privilege('anon', 'public.saved_training_plans', 'SELECT') as anon_can_select;

rollback;
