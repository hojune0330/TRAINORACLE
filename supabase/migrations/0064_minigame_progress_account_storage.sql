-- Minigame tour progress (stars, best game scores, character, game settings) as one more
-- encrypted account-state document. Reuses attested storage and CAS unchanged.
-- No new tables, permissions, public fields, reward eligibility or training authority.
-- Game progress is never reward-eligible: the existing non-JOURNAL rule already rejects
-- eligible:true for every kind other than JOURNAL.
begin;
do $migration$
declare
  source text := pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure);
  anchor text;
begin
  source := replace(replace(source,E'\r\n',E'\n'),E'\r',E'\n');
  anchor := 'if action = ''status'' then return jsonb_build_object(''kind'',''ready''); end if;';
  if position(anchor in source)=0 then raise exception 'MINIGAME_PROGRESS_STATUS_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || E'\n  if action = ''minigameProgressSupport'' then return jsonb_build_object(''kind'',''minigame-progress-support'',''version'',1); end if;');
  anchor := '(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'',''ATHLETE_RECORDS'',''RUNNING_PROFILE'')';
  if position(anchor in source)=0 then raise exception 'MINIGAME_PROGRESS_KIND_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'',''ATHLETE_RECORDS'',''RUNNING_PROFILE'',''MINIGAME_PROGRESS'')');
  execute source;
end;
$migration$;
commit;
