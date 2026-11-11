-- Preserve the deployed function and its permissions. Fail on contract drift.
-- No table, plaintext health field, consent change, backfill or destructive write.
begin;
create index if not exists account_journal_identity_owner_date on public.account_journal_identity(user_id,journal_date,document_id);
create index if not exists garmin_inbox_owner_document on public.garmin_inbox(user_id,document_id) where document_id is not null;
do $migration$
declare definition text; replacement record;
begin
  definition:=pg_get_functiondef('public.garmin_autosave_attested(text,text,text)'::regprocedure);
  for replacement in select * from (values
    ($old$doc uuid; metadata jsonb;$old$,
     $new$doc uuid; metadata jsonb; candidates jsonb; comparison_date date;$new$),
    ($old$action in ('next','commit','review','defer')$old$,
     $new$action in ('next','commit','review','defer','candidates')$new$),
    ($old$proof:=req->'journalProof';$old$,
     $new$if action='candidates' then
      comparison_date:=(req->>'journalDate')::date;
      if comparison_date is null then raise exception 'GARMIN_DENIED' using errcode='42501';end if;
      select coalesce(jsonb_agg(x.data order by x.document_id,x.inbox_id),'[]'::jsonb) into candidates from (
        select i.document_id,g.inbox_id,jsonb_build_object('documentId',i.document_id,'documentRevision',d.revision,
          'active',i.active,'source',to_jsonb(g)) data
        from public.account_journal_identity i
        left join public.account_journal_documents d on d.user_id=i.user_id and d.document_id=i.document_id
        left join public.garmin_inbox g on g.user_id=i.user_id and g.document_id=i.document_id
        where i.user_id=actor and i.journal_date=comparison_date
        order by i.document_id,g.inbox_id limit 65
      ) x;
      if octet_length(candidates::text)>7500000 then return jsonb_build_object('candidates',null,'snapshot',null);end if;
      return jsonb_build_object('candidates',candidates,'snapshot',md5(candidates::text));
    end if;
    proof:=req->'journalProof';$new$),
    ($old$or exists(select 1 from public.account_journal_identity where user_id=actor and (document_id=doc or journal_date=(metadata->>'journalDate')::date))$old$,
     $new$or exists(select 1 from public.account_journal_identity where user_id=actor and document_id=doc)$new$),
    ($old$insert into public.account_journal_cutovers values(actor) on conflict do nothing;$old$,
     $new$-- Re-read under the same owner lock immediately before insert. The signed
    -- server comparison cannot authorize a stale or incomplete candidate set.
    select coalesce(jsonb_agg(x.data order by x.document_id,x.inbox_id),'[]'::jsonb) into candidates from (
      select i.document_id,g.inbox_id,jsonb_build_object('documentId',i.document_id,'documentRevision',d.revision,
        'active',i.active,'source',to_jsonb(g)) data
      from public.account_journal_identity i
      left join public.account_journal_documents d on d.user_id=i.user_id and d.document_id=i.document_id
      left join public.garmin_inbox g on g.user_id=i.user_id and g.document_id=i.document_id
      where i.user_id=actor and i.journal_date=(metadata->>'journalDate')::date
      order by i.document_id,g.inbox_id limit 65
    ) x;
    if jsonb_array_length(candidates)>=65 or
      (jsonb_array_length(candidates)>0 and req->>'collisionSnapshot' is distinct from md5(candidates::text)) then
      update public.garmin_inbox set auto_review_required=true where inbox_id=item.inbox_id;
      return jsonb_build_object('kind','review_required');
    end if;
    insert into public.account_journal_cutovers values(actor) on conflict do nothing;$new$)
  ) as changes(before_text,after_text) loop
    if (length(definition)-length(replace(definition,replacement.before_text,'')))/length(replacement.before_text)<>1 then
      raise exception 'GARMIN_DISTINCT_ACTIVITY_CONTRACT_CHANGED';
    end if;
    definition:=replace(definition,replacement.before_text,replacement.after_text);
  end loop;
  execute definition;
end $migration$;
commit;
