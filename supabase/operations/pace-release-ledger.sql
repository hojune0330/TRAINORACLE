-- Record only the two migrations already applied and verified in this release.
begin;
do $gate$
begin
  if to_regprocedure('public.verify_account_pace_record_revision(uuid,jsonb)') is null
    or position('athleteRecordSupport' in pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure))=0
    or position('<> 21097.5' in pg_get_functiondef('public.oracle_comparison_snapshot_is_safe(jsonb)'::regprocedure))=0 then
    raise exception 'PACE_RELEASE_POSTCONDITIONS_MISSING';
  end if;
end;
$gate$;
insert into supabase_migrations.schema_migrations(version,name)
values ('0049','athlete_record_pace_revision'),('0050','oracle_half_distance');
commit;
