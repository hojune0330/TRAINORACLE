-- Reuse authenticated, attested, encrypted account-state storage and existing CAS.
-- No new permissions, public profile fields, or training authority.
begin;
do $migration$
declare
  source text := pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure);
  anchor text;
begin
  source := replace(replace(source,E'\r\n',E'\n'),E'\r',E'\n');
  anchor := 'if action = ''status'' then return jsonb_build_object(''kind'',''ready''); end if;';
  if position(anchor in source)=0 then raise exception 'RUNNING_PROFILE_STATUS_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || E'\n  if action = ''runningProfileSupport'' then return jsonb_build_object(''kind'',''running-profile-support'',''version'',1); end if;');
  anchor := '(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'',''ATHLETE_RECORDS'')';
  if position(anchor in source)=0 then raise exception 'RUNNING_PROFILE_KIND_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'',''ATHLETE_RECORDS'',''RUNNING_PROFILE'')');
  execute source;
end;
$migration$;
commit;
