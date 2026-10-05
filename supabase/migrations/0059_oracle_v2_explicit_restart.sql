-- Explicit attested restart creates fresh ciphertext, never restores profile history.
-- Ordinary commit continues to refuse SQL tombstones. No grants or activation changes.
begin;
alter table public.account_journal_operations
  drop constraint account_journal_operations_operation_kind_check,
  add constraint account_journal_operations_operation_kind_check
    check (operation_kind in ('commit','delete','restore','restartOracleV2'));

do $migration$
declare
  source text;
  anchor text;
begin
  source := pg_get_functiondef('public.mutate_account_journal_lifecycle(uuid,uuid,bigint,jsonb,text,bigint)'::regprocedure);
  source := replace(replace(source,E'\r\n',E'\n'),E'\r',E'\n');
  anchor := 'action_kind not in (''commit'',''delete'',''restore'')';
  if position(anchor in source)=0 then raise exception 'ORACLE_RESTART_LIFECYCLE_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'action_kind not in (''commit'',''delete'',''restore'',''restartOracleV2'')');
  source := replace(source,'action_kind = ''commit'' and not public.account_journal_envelope_valid',
    'action_kind in (''commit'',''restartOracleV2'') and not public.account_journal_envelope_valid');
  source := replace(source,'action_kind <> ''commit'' and encrypted_payload is not null',
    'action_kind not in (''commit'',''restartOracleV2'') and encrypted_payload is not null');
  source := replace(source,'action_kind = ''commit'' and coalesce(prior.payload_fingerprint',
    'action_kind in (''commit'',''restartOracleV2'') and coalesce(prior.payload_fingerprint');
  anchor := 'fingerprint := sha256(convert_to(encrypted_payload::text, ''UTF8''));';
  if position(anchor in source)=0 then raise exception 'ORACLE_RESTART_FINGERPRINT_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'if action_kind = ''restartOracleV2'' and (expected_revision < 1 or not exists (select 1 from public.account_journal_identity i where i.user_id=owner_id and i.document_id=$1 and i.document_kind=''RUNNING_PROFILE'')) then\n    raise exception ''INVALID_ORACLE_RESTART'' using errcode=''22023'';\n  end if;\n  ' || anchor);
  anchor := '(action_kind = ''restore'' and current_revision = 0)';
  if position(anchor in source)=0 then raise exception 'ORACLE_RESTART_CAS_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'(action_kind in (''restore'',''restartOracleV2'') and current_revision = 0)');
  execute source;

  source := pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure);
  source := replace(replace(source,E'\r\n',E'\n'),E'\r',E'\n');
  anchor := 'if action = ''oracleV2Support'' then return jsonb_build_object(''kind'',''oracle-v2-support'',''version'',2); end if;';
  if position(anchor in source)=0 then raise exception 'ORACLE_RESTART_SUPPORT_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || E'\n  if action = ''oracleV2RestartSupport'' then return jsonb_build_object(''kind'',''oracle-v2-restart-support'',''version'',1); end if;');
  anchor := 'action not in (''commit'',''delete'',''restore'')';
  if position(anchor in source)=0 then raise exception 'ORACLE_RESTART_ATTESTED_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'action not in (''commit'',''delete'',''restore'',''restartOracleV2'')');
  anchor := 'receipt := public.mutate_account_journal_lifecycle(doc,op,expected,';
  if position(anchor in source)=0 then raise exception 'ORACLE_RESTART_DISPATCH_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'if action = ''restartOracleV2'' and (document_kind is distinct from ''RUNNING_PROFILE'' or expected < 1) then\n    raise exception ''INVALID_ORACLE_RESTART'' using errcode=''22023'';\n  end if;\n  ' || anchor);
  source := replace(source,'case when action = ''commit'' then request->''encryptedPayload'' else null end',
    'case when action in (''commit'',''restartOracleV2'') then request->''encryptedPayload'' else null end');
  execute source;
end;
$migration$;
commit;
