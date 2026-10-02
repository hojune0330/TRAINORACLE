-- Additive global calendar decoration document support. Keep DECORATIONS v3 readers.
-- No reward, purchase, migration grant or athlete rows are created by this migration.
begin;

create function public.verify_account_calendar_decoration_ownership(owner_id uuid, metadata jsonb)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare
  ownership_doc uuid;
  ownership_revision bigint;
  paid_reference jsonb;
begin
  if jsonb_typeof(metadata->'ownershipDocumentId') is distinct from 'string'
    or metadata->>'ownershipDocumentId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(metadata->'ownershipRevision') is distinct from 'number'
    or metadata->>'ownershipRevision' !~ '^[1-9][0-9]{0,15}$'
    or jsonb_typeof(metadata->'paidReferenceItemIds') is distinct from 'array'
    or jsonb_array_length(metadata->'paidReferenceItemIds') > 7
    or jsonb_array_length(metadata->'paidReferenceItemIds') <> (
      select count(distinct value) from jsonb_array_elements(metadata->'paidReferenceItemIds') value)
    or exists(select 1 from jsonb_array_elements(metadata->'paidReferenceItemIds') value
      where jsonb_typeof(value) <> 'string') then
    raise exception 'INVALID_CALENDAR_DECORATION_METADATA' using errcode='22023';
  end if;
  ownership_doc := (metadata->>'ownershipDocumentId')::uuid;
  -- Caller holds the existing per-account advisory transaction lock. A gateway
  -- ownership read cannot race an intervening purchase, delete or restore.
  select d.revision into ownership_revision from public.account_journal_documents d
    join public.account_journal_identity i on i.user_id=d.user_id and i.document_id=d.document_id
    where d.user_id=owner_id and d.document_id=ownership_doc and d.deleted_at is null
      and i.document_kind='DECORATIONS' and i.active;
  if ownership_revision is distinct from (metadata->>'ownershipRevision')::bigint then
    raise exception 'CALENDAR_DECORATION_OWNERSHIP_CHANGED' using errcode='TD001';
  end if;
  for paid_reference in select value from jsonb_array_elements(metadata->'paidReferenceItemIds') loop
    if not exists(select 1 from public.account_decoration_purchases p
      where p.user_id=owner_id and p.item_id=(paid_reference #>> '{}'))
      and not exists(select 1 from public.account_decoration_legacy_grants g,
        jsonb_array_elements(g.items) item where g.user_id=owner_id and item->>'itemId'=(paid_reference #>> '{}')) then
      raise exception 'CALENDAR_DECORATION_OWNERSHIP_CHANGED' using errcode='TD001';
    end if;
  end loop;
end;
$$;
revoke all on function public.verify_account_calendar_decoration_ownership(uuid,jsonb) from public,anon,authenticated,service_role;

-- Preserve the installed gateway definition and all intervening safety changes.
-- Assert every replacement anchor; a drifted definition aborts rather than weakening it.
do $migration$
declare
  source text := pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure);
  anchor text;
begin
  anchor := 'if action = ''status'' then return jsonb_build_object(''kind'',''ready''); end if;';
  if position(anchor in source)=0 then raise exception 'CALENDAR_MIGRATION_STATUS_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || E'\n  if action = ''calendarDecorationSupport'' then return jsonb_build_object(''kind'',''calendar-decoration-support'',''version'',1); end if;');
  anchor := '''kind'',''occurrenceId'',''journalDate'',''eligible'',''purchases'',''spentPoints'',''awardAllowed'',''legacyInitialGrant''';
  if position(anchor in source)=0 then raise exception 'CALENDAR_MIGRATION_METADATA_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,anchor || ',''ownershipDocumentId'',''ownershipRevision'',''paidReferenceItemIds''');
  anchor := '(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'')';
  if position(anchor in source)=0 then raise exception 'CALENDAR_MIGRATION_KIND_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,'(''DRAFT'',''JOURNAL'',''DECORATIONS'',''PLAN'',''CALENDAR_DECORATIONS'')');
  anchor := 'if identity_row.document_id is not null and (identity_row.document_kind is distinct from document_kind';
  if position(anchor in source)=0 then raise exception 'CALENDAR_MIGRATION_METADATA_SCOPE_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'if (document_kind = ''CALENDAR_DECORATIONS'' and metadata ?| array[''purchases'',''spentPoints'',''awardAllowed'',''legacyInitialGrant''])\n      or (document_kind <> ''CALENDAR_DECORATIONS'' and metadata ?| array[''ownershipDocumentId'',''ownershipRevision'',''paidReferenceItemIds'']) then\n      raise exception ''INVALID_CALENDAR_DECORATION_METADATA_SCOPE'' using errcode=''22023'';\n    end if;\n    ' || anchor);
  anchor := 'receipt := public.mutate_account_journal_lifecycle(doc,op,expected,';
  if position(anchor in source)=0 then raise exception 'CALENDAR_MIGRATION_OWNERSHIP_ANCHOR_MISSING'; end if;
  source := replace(source,anchor,E'if document_kind = ''CALENDAR_DECORATIONS'' and prior_metadata is null then\n    perform public.verify_account_calendar_decoration_ownership(owner_id,metadata);\n  end if;\n  ' || anchor);
  execute source;
end;
$migration$;

commit;
