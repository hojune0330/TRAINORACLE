-- A successfully persisted rotating token is known, even when a later permissions
-- request fails. Resume that successor instead of making the user reconnect.
-- Unknown STARTED exchanges, withdrawn consent and stopped controls stay closed.
begin;

do $$
declare definition text; change record; occurrences integer;
begin
  if to_regprocedure('public.garmin_maintenance_attested(text,text,text)') is null
    or to_regprocedure('public.garmin_integration_attested(text,text,text)') is null then
    raise exception 'GARMIN_PERMISSION_RETRY_PREREQUISITE_MISSING';
  end if;
  definition:=pg_get_functiondef('public.garmin_maintenance_attested(text,text,text)'::regprocedure);
  for change in select * from (values
    ($old$c.refresh_nonce is not null and c.rotation_phase<>'CLAIMED'$old$,
     $new$c.refresh_nonce is not null and c.rotation_phase not in ('CLAIMED','ROTATED')$new$),
    ($old$rotation_phase='CLAIMED',rotation_session_id=null where user_id=actor returning * into c;$old$,
     $new$rotation_phase=case when rotation_phase='ROTATED' then 'ROTATED' else 'CLAIMED' end,
      rotation_session_id=case when rotation_phase='ROTATED' then rotation_session_id else null end
      where user_id=actor returning * into c;$new$),
    ($old$if action='fail' then$old$,
     $new$if action='fail' then
    if c.rotation_phase='ROTATED' and c.state='ACTIVE' and ready and current_subject and current_session then
      update public.garmin_connections set maintenance_due_at=clock_timestamp()+interval '1 minute',
        refresh_until=null where user_id=actor;
      return jsonb_build_object('kind','retry_scheduled');
    end if;$new$),
    ($old$c.rotation_phase not in ('IDLE','CLAIMED')$old$,
     $new$c.rotation_phase not in ('IDLE','CLAIMED','ROTATED')$new$)
  ) as changes(before_text,after_text) loop
    occurrences:=(length(definition)-length(replace(definition,change.before_text,'')))/length(change.before_text);
    if occurrences<>1 then raise exception 'GARMIN_PERMISSION_RETRY_CONTRACT_CHANGED'; end if;
    definition:=replace(definition,change.before_text,change.after_text);
  end loop;
  execute definition;

  -- A manual retry must not mark the recoverable persisted successor as an
  -- ambiguous exchange. Its existing background lease owns completion.
  definition:=pg_get_functiondef('public.garmin_integration_attested(text,text,text)'::regprocedure);
  occurrences:=(length(definition)-length(replace(definition,
    'if c.refresh_until>clock_timestamp() then return jsonb_build_object(''error'',''BUSY'');end if;','')))
    /length('if c.refresh_until>clock_timestamp() then return jsonb_build_object(''error'',''BUSY'');end if;');
  if occurrences<>1 then raise exception 'GARMIN_PERMISSION_RETRY_LEASE_CONTRACT_CHANGED'; end if;
  execute replace(definition,
    'if c.refresh_until>clock_timestamp() then return jsonb_build_object(''error'',''BUSY'');end if;',
    'if c.rotation_phase=''ROTATED'' or c.refresh_until>clock_timestamp() then return jsonb_build_object(''error'',''BUSY'');end if;');
end $$;

commit;
