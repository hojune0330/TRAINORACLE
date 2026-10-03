-- PRE-0046 only. Catalog metadata, no application rows, RPC calls or key material.
-- Every passed value must be true. Errors, NULLs or false mean STOP.
begin read only;
with required_functions(key, signature) as (values
  ('journal','public.mutate_account_journal_attested(text,text,text)'),
  ('replan','public.mutate_account_plan_replan_attested(text,text,text)'),
  ('collection','public.mutate_account_plan_collection_attested(text,text,text)'),
  ('catalog','public.mutate_account_plan_catalog_replacement_attested(text,text,text)'),
  ('calendar_ownership','public.verify_account_calendar_decoration_ownership(uuid,jsonb)'),
  ('owner','public.account_journal_lifecycle_owner()'),
  ('lifecycle','public.mutate_account_journal_lifecycle(uuid,uuid,bigint,jsonb,text,bigint)'),
  ('exact','public.account_plan_exact(jsonb,text[])'),
  ('hash','public.account_plan_hash(text,jsonb)'),
  ('hmac','extensions.hmac(bytea,bytea,text)')
), definitions as (
  select f.*, p.oid, p.prosecdef, p.proconfig,
    replace(replace(case when p.oid is not null then pg_get_functiondef(p.oid) end,
      E'\r\n',E'\n'),E'\r',E'\n') as source
  from required_functions f left join pg_proc p on p.oid=to_regprocedure(f.signature)
), anchors(id, key, needle) as (values
  -- The same nine exact anchors used by 0046, with the same line-ending normalization.
  ('0046.status','journal',$a$if action = 'status' then return jsonb_build_object('kind','ready'); end if;$a$),
  ('0046.kind','journal',$a$('DRAFT','JOURNAL','DECORATIONS','PLAN','CALENDAR_DECORATIONS')$a$),
  ('0046.metadata','journal',$a$'kind','occurrenceId','journalDate','eligible','purchases','spentPoints','awardAllowed','legacyInitialGrant','ownershipDocumentId','ownershipRevision','paidReferenceItemIds'$a$),
  ('0046.scope','journal',$a$if identity_row.document_id is not null and (identity_row.document_kind is distinct from document_kind$a$),
  ('0046.write','journal',$a$receipt := public.mutate_account_journal_lifecycle(doc,op,expected,$a$),
  ('0046.optional_journal','replan',E'or jsonb_typeof(req->''journalGuard'') is distinct from ''array''\n    or jsonb_array_length(req->''journalGuard'')>5000'),
  ('0046.strip','replan',$a$stripped := (req-'journalGuard')::text;$a$),
  ('0046.guard','replan',$a$if exists(select 1 from jsonb_array_elements(req->'journalGuard') v$a$),
  ('0046.journal_end','replan',$a$-- Original routine validates expiry, CAS, immutable history, index and receipt binding.$a$),
  -- Ledger gaps must not hide missing 0043/0044/0045 behavior.
  ('0043.timezone','catalog',$a$not exists(select 1 from pg_timezone_names where name=calendar->>'timeZone')$a$),
  ('0043.forward','catalog',$a$public.mutate_account_plan_replan_attested(stripped,stripped_signature,key_id)$a$),
  ('0044.collection_binding','collection',$a$request_doc := request_doc || jsonb_build_object('journalGuard',req->'journalGuard');$a$),
  ('0044.replan_binding','replan',$a$'legacy',req->'legacy','journalGuard',req->'journalGuard')) then$a$),
  ('0044.replan_preserve','replan',$a$stripped := req::text;$a$),
  ('0045.capability','journal',$a$if action = 'calendarDecorationSupport' then$a$),
  ('0045.ownership','journal',$a$perform public.verify_account_calendar_decoration_ownership(owner_id,metadata);$a$)
), required_columns(table_name, column_name, type_name) as (values
  ('account_journal_documents','user_id','uuid'),
  ('account_journal_documents','document_id','uuid'),
  ('account_journal_documents','revision','bigint'),
  ('account_journal_documents','deleted_at','timestamp with time zone'),
  ('account_journal_documents','encrypted_payload','jsonb'),
  ('account_journal_identity','user_id','uuid'),
  ('account_journal_identity','document_id','uuid'),
  ('account_journal_identity','document_kind','text'),
  ('account_journal_identity','active','boolean'),
  ('account_journal_operations','trusted_metadata','jsonb'),
  ('account_plan_collection_receipts','request_document','jsonb'),
  ('account_plan_collection_receipts','request_fingerprint','text')
), checks as (
  select 'function.'||key as check_id, oid is not null as passed from definitions
  union all
  select 'security.'||key, coalesce(prosecdef and 'search_path=pg_catalog'=any(proconfig),false)
    from definitions where key in ('journal','replan','collection','catalog','calendar_ownership')
  union all
  select 'anchor.'||a.id, coalesce(position(a.needle in d.source)>0,false)
    from anchors a join definitions d using(key)
  union all
  select 'column.'||c.table_name||'.'||c.column_name, exists(
    select 1 from pg_attribute a where a.attrelid=to_regclass('public.'||c.table_name)
      and a.attname=c.column_name and not a.attisdropped and a.attnum>0
      and a.atttypid=to_regtype(c.type_name))
    from required_columns c
  union all
  select 'role.'||name, exists(select 1 from pg_roles where rolname=name)
    from (values ('anon'),('authenticated'),('service_role')) r(name)
  union all
  select '0046.helper_absent',
    to_regprocedure('public.verify_account_pace_record_revision(uuid,jsonb)') is null
  union all
  select '0046.capability_absent', coalesce(position('athleteRecordSupport' in source)=0,false)
    from definitions where key='journal'
)
select check_id, passed from checks order by check_id;
rollback;
