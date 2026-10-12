-- Local implementation source. Generate its migration with the Supabase CLI
-- before deployment; do not execute this proposal on production directly.
-- Reuses the encrypted gateway, authenticated owner, per-owner advisory lock,
-- operation receipts and CAS. No feature activation or permission expansion.
begin;

create function public.verify_account_goal_program_parts(owner_id uuid, metadata jsonb)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare part jsonb; part_doc uuid; verified boolean;
begin
  if owner_id is distinct from auth.uid() or jsonb_typeof(metadata->'goalProgramParts') is distinct from 'array'
    or jsonb_array_length(metadata->'goalProgramParts') > 38
    or jsonb_array_length(metadata->'goalProgramParts') <> (
      select count(distinct value->>'documentId') from jsonb_array_elements(metadata->'goalProgramParts') value) then
    raise exception 'INVALID_GOAL_PROGRAM_REFERENCES' using errcode='22023';
  end if;
  for part in select value from jsonb_array_elements(metadata->'goalProgramParts') order by value->>'documentId' loop
    if jsonb_typeof(part) is distinct from 'object' or not part ?& array['documentId','kind','partId']
      or part - array['documentId','kind','partId'] <> '{}'::jsonb
      or jsonb_typeof(part->'documentId') is distinct from 'string'
      or jsonb_typeof(part->'partId') is distinct from 'string'
      or jsonb_typeof(part->'kind') is distinct from 'string'
      or part->>'documentId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or part->>'partId' !~ '^sha256:[a-f0-9]{64}$'
      or part->>'kind' not in ('GOAL_PROGRAM_BODY','GOAL_PROGRAM_PROGRESS') then
      raise exception 'INVALID_GOAL_PROGRAM_REFERENCES' using errcode='22023';
    end if;
    part_doc := (part->>'documentId')::uuid;
    select exists(
      select 1 from public.account_journal_documents d
      join public.account_journal_identity i on i.user_id=d.user_id and i.document_id=d.document_id
      join public.account_journal_operations o on o.user_id=d.user_id and o.document_id=d.document_id
      where d.user_id=owner_id and d.document_id=part_doc and d.revision=1 and d.deleted_at is null
        and i.active and i.document_kind=part->>'kind' and o.result->>'kind'='saved'
        and o.result->>'revision'='1' and o.trusted_metadata->>'goalProgramPartId'=part->>'partId'
    ) into verified;
    if not verified then raise exception 'GOAL_PROGRAM_REFERENCE_UNAVAILABLE' using errcode='22023'; end if;
  end loop;
end;
$$;
revoke all on function public.verify_account_goal_program_parts(uuid,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare source text := pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure); anchor text;
begin
  source := replace(replace(source,E'\r\n',E'\n'),E'\r',E'\n');
  anchor := 'if action = ''status'' then return jsonb_build_object(''kind'',''ready''); end if;';
  if position(anchor in source)=0 then raise exception 'GOAL_PROGRAM_SUPPORT_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || E'\n  if action = ''goalProgramSupport'' then return jsonb_build_object(''kind'',''goal-program-support'',''version'',1); end if;');
  -- Require the reviewed 0001..0064 chain, including encrypted game storage.
  -- Refuse an unexpected kind list instead of dropping another feature's kind.
  anchor := '(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'',''ATHLETE_RECORDS'',''RUNNING_PROFILE'',''MINIGAME_PROGRESS'')';
  if position(anchor in source)=0 then raise exception 'GOAL_PROGRAM_KIND_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'',''ATHLETE_RECORDS'',''RUNNING_PROFILE'',''MINIGAME_PROGRESS'',''GOAL_PROGRAM_BODY'',''GOAL_PROGRAM_PROGRESS'',''GOAL_PROGRAM_INDEX'')');
  anchor := '''paidReferenceItemIds''';
  -- Limit this replacement to the existing metadata allowlist.
  if position('metadata - array[' in source)=0 then raise exception 'GOAL_PROGRAM_METADATA_ANCHOR_MISSING'; end if;
  source := regexp_replace(source, '(metadata - array\[[^\]]*)\]', '\1,''goalProgramPartId'',''goalProgramParts'']');
  anchor := 'if document_kind = ''JOURNAL'' and expected = 0 and exists (';
  if position(anchor in source)=0 then raise exception 'GOAL_PROGRAM_COMMIT_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'if identity_row.document_kind in (''GOAL_PROGRAM_BODY'',''GOAL_PROGRAM_PROGRESS'',''GOAL_PROGRAM_INDEX'') and action <> ''commit'' then\n    raise exception ''GOAL_PROGRAM_IMMUTABLE_LIFECYCLE'' using errcode=''22023'';\n  end if;\n  if action = ''commit'' then\n    if document_kind in (''GOAL_PROGRAM_BODY'',''GOAL_PROGRAM_PROGRESS'') then\n      if expected <> 0 or metadata->>''goalProgramPartId'' is null or metadata->>''goalProgramPartId'' !~ ''^sha256:[a-f0-9]{64}$'' or metadata ? ''goalProgramParts'' then\n        raise exception ''INVALID_GOAL_PROGRAM_PART'' using errcode=''22023'';\n      end if;\n    elsif document_kind = ''GOAL_PROGRAM_INDEX'' then\n      if metadata ? ''goalProgramPartId'' then raise exception ''INVALID_GOAL_PROGRAM_REFERENCES'' using errcode=''22023''; end if;\n      perform public.verify_account_goal_program_parts(owner_id,metadata);\n    elsif metadata ?| array[''goalProgramPartId'',''goalProgramParts''] then\n      raise exception ''INVALID_GOAL_PROGRAM_METADATA_SCOPE'' using errcode=''22023'';\n    end if;\n  end if;\n  ' || anchor);
  execute source;
end;
$migration$;
commit;
