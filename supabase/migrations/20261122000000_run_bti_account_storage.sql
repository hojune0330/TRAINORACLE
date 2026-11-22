-- A separate, owner-bound encrypted self-report. Existing storage admission, consent
-- revision checks, account rights and journal rewards retain their existing scope.
begin;
do $migration$
declare
  source text;
  anchor text;
begin
  source := replace(pg_get_functiondef('public.mutate_account_journal_attested(text,text,text)'::regprocedure), E'\r', '');
  anchor := 'if action = ''status'' then return jsonb_build_object(''kind'',''ready''); end if;';
  if position(anchor in source) = 0 then raise exception 'RUN_BTI_CAPABILITY_ANCHOR_MISSING'; end if;
  source := replace(source, anchor, anchor || $body$
  if action = 'runBtiProfileSupport' or request->'metadata'->>'kind' = 'RUN_BTI_PROFILE' then
    declare
      service_date date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
      answer_time timestamptz;
      eligible boolean;
      id_bytes bytea;
    begin
      if action <> 'runBtiProfileSupport' then
        if action <> 'commit' or jsonb_typeof(request->'runBtiAnsweredAt') is distinct from 'string' then
          raise exception 'INVALID_RUN_BTI_WRITE' using errcode='22023';
        end if;
        answer_time := (request->>'runBtiAnsweredAt')::timestamptz;
        if not isfinite(answer_time) or answer_time > clock_timestamp() + interval '5 minutes' then
          raise exception 'INVALID_RUN_BTI_ANSWER_TIME' using errcode='22023';
        end if;
        service_date := least(service_date, (answer_time at time zone 'Asia/Seoul')::date);
        id_bytes := substring(sha256(convert_to(format('["trainoracle.account.run-bti-profile.v1","%s"]',owner_id),'UTF8')) from 1 for 16);
        id_bytes := set_byte(set_byte(id_bytes, 6, (get_byte(id_bytes, 6) & 15) | 80), 8, (get_byte(id_bytes, 8) & 63) | 128);
        if doc is distinct from encode(id_bytes,'hex')::uuid then
          raise exception 'INVALID_RUN_BTI_DOCUMENT' using errcode='22023';
        end if;
      end if;
      select exists(select 1 from public.user_private_profiles p where p.user_id=owner_id
        and p.deletion_requested_at is null and p.birth_date <= service_date - interval '19 years') into eligible;
      if action = 'runBtiProfileSupport' then
        return jsonb_build_object('kind','run-bti-profile-support','version',1,'eligible',eligible);
      end if;
      if not eligible then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
    end;
  end if;$body$);
  -- Keep the exact legacy list available to independently installed capabilities.
  anchor := 'if document_kind is null or document_kind not in (';
  if position(anchor in source) = 0 then raise exception 'RUN_BTI_KIND_ANCHOR_MISSING'; end if;
  source := replace(source, anchor, 'if document_kind is null or document_kind <> ''RUN_BTI_PROFILE'' and document_kind not in (');
  execute source;

  -- Freshly selected fields may replace a tombstone at its exact revision.
  -- Never restore an earlier copy of a RUN_BTI_PROFILE.
  source := replace(pg_get_functiondef('public.mutate_account_journal_lifecycle(uuid,uuid,bigint,jsonb,text,bigint)'::regprocedure), E'\r', '');
  anchor := '(action_kind = ''commit'' and current_doc.deleted_at is not null)';
  if position(anchor in source) = 0 then raise exception 'RUN_BTI_TOMBSTONE_ANCHOR_MISSING'; end if;
  source := replace(source, anchor, $body$(action_kind = 'commit' and current_doc.deleted_at is not null
      and not exists(select 1 from public.account_journal_identity i where i.user_id=owner_id
        and i.document_id=$1 and i.document_kind='RUN_BTI_PROFILE'))$body$);
  execute source;
end;
$migration$;
commit;
