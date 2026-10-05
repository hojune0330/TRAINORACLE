-- Additive compatibility probe only. No document rewrite, grants, or feature activation.
begin;
do $migration$
declare
  source text := pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure);
  anchor text := 'if action = ''runningProfileSupport'' then return jsonb_build_object(''kind'',''running-profile-support'',''version'',1); end if;';
begin
  source := replace(replace(source,E'\r\n',E'\n'),E'\r',E'\n');
  if position(anchor in source)=0 then raise exception 'ORACLE_V2_SUPPORT_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || E'\n  if action = ''oracleV2Support'' then return jsonb_build_object(''kind'',''oracle-v2-support'',''version'',2); end if;');
  execute source;
end;
$migration$;
commit;
