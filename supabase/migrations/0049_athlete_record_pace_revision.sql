-- Reuse ACCOUNT_STATE storage. No new table, login role, or access grant.
-- Renumbered before release: main already owns migrations 0046-0048.
begin;

create function public.verify_account_pace_record_revision(owner_id uuid, metadata jsonb)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare
  source_doc uuid;
  source_revision bigint;
begin
  if jsonb_typeof(metadata->'paceRecordDocumentId') is distinct from 'string'
    or metadata->>'paceRecordDocumentId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(metadata->'paceRecordRevision') is distinct from 'number'
    or metadata->>'paceRecordRevision' !~ '^[1-9][0-9]{0,15}$' then
    raise exception 'INVALID_PACE_RECORD_GUARD' using errcode='22023';
  end if;
  source_doc := (metadata->>'paceRecordDocumentId')::uuid;
  -- The gateway already holds the account advisory transaction lock.
  select d.revision into source_revision from public.account_journal_documents d
    join public.account_journal_identity i on i.user_id=d.user_id and i.document_id=d.document_id
    where d.user_id=owner_id and d.document_id=source_doc and d.deleted_at is null
      and i.document_kind='ATHLETE_RECORDS' and i.active;
  if source_revision is distinct from (metadata->>'paceRecordRevision')::bigint then
    raise exception 'PACE_RECORD_SOURCE_CHANGED' using errcode='TD001';
  end if;
end;
$$;
revoke all on function public.verify_account_pace_record_revision(uuid,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare
  source text := pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure);
  anchor text;
begin
  -- pg_get_functiondef preserves checkout line endings; keep all other anchor text exact.
  source := replace(replace(source,E'\r\n',E'\n'),E'\r',E'\n');
  anchor := 'if action = ''status'' then return jsonb_build_object(''kind'',''ready''); end if;';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_STATUS_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || E'\n  if action = ''athleteRecordSupport'' then return jsonb_build_object(''kind'',''athlete-record-support'',''version'',1); end if;');
  anchor := '(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'')';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_KIND_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'',''ATHLETE_RECORDS'')');
  anchor := '''kind'',''occurrenceId'',''journalDate'',''eligible'',''purchases'',''spentPoints'',''awardAllowed'',''legacyInitialGrant'',''ownershipDocumentId'',''ownershipRevision'',''paidReferenceItemIds''';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_METADATA_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || ',''paceRecordDocumentId'',''paceRecordRevision''');
  anchor := 'if identity_row.document_id is not null and (identity_row.document_kind is distinct from document_kind';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_SCOPE_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'if document_kind <> ''PLAN'' and metadata ?| array[''paceRecordDocumentId'',''paceRecordRevision''] then\n      raise exception ''INVALID_PACE_RECORD_GUARD_SCOPE'' using errcode=''22023'';\n    end if;\n    ' || anchor);
  anchor := 'receipt := public.mutate_account_journal_lifecycle(doc,op,expected,';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_WRITE_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'if document_kind = ''PLAN'' and prior_metadata is null and metadata ?| array[''paceRecordDocumentId'',''paceRecordRevision''] then\n    perform public.verify_account_pace_record_revision(owner_id,metadata);\n  end if;\n  ' || anchor);
  execute source;
end;
$migration$;

-- Collection commits use the journal-guard wrapper rather than the single-document
-- gateway. Check the same source revision in that transaction before forwarding.
do $migration$
declare
  source text := pg_get_functiondef('public.mutate_account_plan_replan_attested(text,text,text)'::regprocedure);
  anchor text;
begin
  source := replace(replace(source,E'\r\n',E'\n'),E'\r',E'\n');
  anchor := E'or jsonb_typeof(req->''journalGuard'') is distinct from ''array''\n    or jsonb_array_length(req->''journalGuard'')>5000';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_COLLECTION_OPTIONAL_JOURNAL_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'or not (req ? ''journalGuard'' or req ? ''paceRecordGuard'')\n    or (req ? ''journalGuard'' and (jsonb_typeof(req->''journalGuard'') is distinct from ''array''\n      or jsonb_array_length(req->''journalGuard'')>5000))');
  anchor := 'stripped := (req-''journalGuard'')::text;';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_COLLECTION_STRIP_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'stripped := (req-''journalGuard''-''paceRecordGuard'')::text;');
  anchor := 'if exists(select 1 from jsonb_array_elements(req->''journalGuard'') v';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_COLLECTION_GUARD_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'if req ? ''paceRecordGuard'' then\n    if not public.account_plan_exact(req->''paceRecordGuard'',array[''documentId'',''revision'']) then\n      raise exception ''INVALID_PACE_RECORD_GUARD'' using errcode=''22023'';\n    end if;\n    begin\n      perform public.verify_account_pace_record_revision(owner_id,jsonb_build_object(''paceRecordDocumentId'',req#>''{paceRecordGuard,documentId}'',''paceRecordRevision'',req#>''{paceRecordGuard,revision}''));\n    exception when sqlstate ''TD001'' then return jsonb_build_object(''kind'',''conflict'');\n    end;\n  end if;\n  if req ? ''journalGuard'' then\n  ' || anchor);
  anchor := '-- Original routine validates expiry, CAS, immutable history, index and receipt binding.';
  if position(anchor in source)=0 then raise exception 'PACE_RECORD_COLLECTION_JOURNAL_END_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'end if;\n  ' || anchor);
  execute source;
end;
$migration$;

commit;
