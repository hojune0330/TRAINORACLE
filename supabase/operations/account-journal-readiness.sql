-- Read-only, metadata and aggregate counts only. Run after migrations 0032-0036.
-- This is not a key backup, JWT isolation test, or permission to activate.
begin read only;
select version from supabase_migrations.schema_migrations
where version in ('0032','0033','0034','0035','0036') order by version;

select feature_key, enabled from public.service_feature_controls
where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2');

select count(*) filter (where enabled) as active_signing_key_versions
from public.account_journal_gateway_keys;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anonymous_can_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as client_can_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as client_can_update
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'account_journal_documents','account_journal_operations','account_journal_history',
  'account_journal_gateway_keys','account_journal_identity','account_reward_days',
  'account_decoration_purchases') order by c.relname;

select count(*) as unreconciled_live_documents
from public.account_journal_documents d
left join public.account_journal_identity i using (user_id, document_id)
where i.document_id is null;

select has_function_privilege('anon','public.run_account_journal_retention_batch()','EXECUTE')
  as anonymous_can_run_global_cleanup,
  has_function_privilege('authenticated','public.run_account_journal_retention_batch()','EXECUTE')
  as client_can_run_global_cleanup;
select exists(select 1 from pg_extension where extname = 'pg_cron') as cron_installed;
rollback;
