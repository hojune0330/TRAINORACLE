-- One-row, read-only operational summary. Contains no document payloads or key bytes.
begin read only;

with protected_tables as (
  select c.relname,
    c.relrowsecurity as rls_enabled,
    has_table_privilege('anon', c.oid, 'SELECT') as anonymous_can_select,
    has_table_privilege('authenticated', c.oid, 'INSERT') as client_can_insert,
    has_table_privilege('authenticated', c.oid, 'UPDATE') as client_can_update
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'account_journal_documents',
      'account_journal_operations',
      'account_journal_history',
      'account_journal_gateway_keys',
      'account_journal_identity',
      'account_reward_days',
      'account_decoration_purchases',
      'account_plan_collection_parts',
      'account_plan_collection_indexes',
      'account_plan_collection_receipts'
    )
)
select
  (select count(*) from supabase_migrations.schema_migrations
    where version in ('0032','0033','0034','0035','0036','0037')) as migration_count,
  public.service_feature_enabled('ACCOUNT') as account_enabled,
  public.service_feature_enabled('ACCOUNT_JOURNAL_V2') as journal_enabled,
  (select count(*) from public.account_journal_gateway_keys where enabled) as enabled_gateway_keys,
  (select count(*) from public.account_journal_documents) as journal_documents,
  (select count(*) from public.account_plan_collection_indexes) as plan_indexes,
  (select count(*) from protected_tables) as protected_table_count,
  (select bool_and(rls_enabled) from protected_tables) as all_rls_enabled,
  (select not bool_or(anonymous_can_select or client_can_insert or client_can_update)
    from protected_tables) as direct_client_access_blocked,
  (select count(*) from public.account_journal_documents d
    left join public.account_journal_identity i using (user_id, document_id)
    where i.document_id is null) as orphan_documents,
  has_function_privilege('anon','public.run_account_journal_retention_batch()','EXECUTE')
    as anonymous_can_run_retention,
  has_function_privilege('authenticated','public.run_account_journal_retention_batch()','EXECUTE')
    as client_can_run_retention,
  exists(select 1 from pg_extension where extname = 'pg_cron') as cron_installed;

rollback;
