-- Joined read only. No table, new credentials or historical write.
begin;
create function public.garmin_weekly_distance_snapshot(
  owner_id uuid, connection uuid, connection_epoch uuid, as_of date, expected_snapshot text
) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
declare
  monday date := as_of - (extract(isodow from as_of)::integer - 1);
  item record; rows jsonb[] := '{}'; versions jsonb[] := '{}'; stamp text;
  payload jsonb; total_bytes bigint := 0; item_count integer := 0;
begin
  for item in
    select i.journal_date, d.revision, g.source_revision, g.state, g.activity_hash,
      g.inbox_id, g.document_id, g.journal_entry_id, g.receipt, g.confirmation_operation,
      g.encrypted_observation, g.encrypted_context, d.encrypted_payload,
      (g.state='CONFIRMED' and g.receipt->>'kind'='saved'
        and g.receipt->>'operationId'=g.confirmation_operation::text
        and g.receipt->>'documentId'=d.document_id::text
        and g.receipt->>'revision'=d.revision::text) as verified
    from public.account_journal_identity i
    join public.account_journal_documents d using (user_id,document_id)
    join public.garmin_inbox g using (user_id,document_id)
    where i.user_id=owner_id and i.active and i.document_kind='JOURNAL'
      and g.connection_id=connection and g.epoch=connection_epoch
      and (i.journal_date between monday and as_of or i.journal_date between monday-7 and as_of-7)
    order by g.inbox_id limit 129
  loop
    item_count:=item_count+1;
    if item_count>128 then return jsonb_build_object('error','REVIEW_REQUIRED'); end if;
    versions:=array_append(versions,jsonb_build_array(item.document_id,item.revision,item.inbox_id,
      item.source_revision,item.state,item.journal_date,item.activity_hash,item.journal_entry_id,
      item.receipt,item.confirmation_operation));
    if expected_snapshot is not null then continue; end if;
    payload:=jsonb_build_object('date',item.journal_date,'activity_hash',item.activity_hash);
    if item.verified is true then
      payload:=payload||jsonb_build_object('user_id',owner_id,'connection_id',connection,'epoch',connection_epoch,
        'inbox_id',item.inbox_id,'document_id',item.document_id,'entry_id',item.journal_entry_id,'source_revision',item.source_revision,
        'encrypted_observation',item.encrypted_observation,'encrypted_context',item.encrypted_context,'journal',item.encrypted_payload);
    end if;
    total_bytes:=total_bytes+octet_length(payload::text);
    if total_bytes>6000000 then return jsonb_build_object('error','REVIEW_REQUIRED'); end if;
    rows:=array_append(rows,payload);
  end loop;
  stamp:=encode(extensions.digest(jsonb_build_array(owner_id,connection,connection_epoch,as_of,versions)::text,'sha256'),'hex');
  if expected_snapshot is not null then
    if stamp<>expected_snapshot then return jsonb_build_object('error','SOURCE_CHANGED'); end if;
    return jsonb_build_object('kind','verified');
  end if;
  return jsonb_build_object('rows',rows,'snapshot',stamp);
end $$;
revoke all on function public.garmin_weekly_distance_snapshot(uuid,uuid,uuid,date,text) from public,anon,authenticated,service_role;

-- Dispatch only after the current owner/session, purposes, revision, active connection,
-- provider capability and ACTIVITY_EXPORT checks in the existing signed gateway.
do $migration$
declare definition text; change record;
begin
  definition:=pg_get_functiondef('public.garmin_integration_attested(text,text,text)'::regprocedure);
  for change in select * from (values
    ($old$action is null or action not in ('status','disconnect'$old$,
     $new$action is null or action not in ('weeklySnapshot','status','disconnect'$new$),
    ($old$if action='verify' then$old$,
     $new$if action='weeklySnapshot' then
      return public.garmin_weekly_distance_snapshot(actor,c.connection_id,c.epoch,(req->>'today')::date,req->>'expectedSnapshot');
    end if;
    if action='verify' then$new$)
  ) as changes(before_text,after_text) loop
    if (length(definition)-length(replace(definition,change.before_text,'')))/length(change.before_text)<>1 then
      raise exception 'GARMIN_WEEKLY_DISTANCE_CONTRACT_CHANGED';
    end if;
    definition:=replace(definition,change.before_text,change.after_text);
  end loop;
  execute definition;
end $migration$;
commit;
