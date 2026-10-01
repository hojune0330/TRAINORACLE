-- Bind manual replacement calendar checks to the same transaction as the existing journal/plan guard.
-- Renumbered from 0041 during parallel-main integration; SQL body is unchanged.
begin;
create function public.mutate_account_plan_catalog_replacement_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  owner_id uuid := public.account_journal_lifecycle_owner();
  signing_key bytea; req jsonb; calendar jsonb; stripped text; stripped_signature text; result jsonb;
begin
  if request_text is null or octet_length(request_text)>1600000
    or signature is null or signature !~ '^[a-f0-9]{64}$' then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode='42501';
  end if;
  select k.secret into signing_key from public.account_journal_gateway_keys k where k.key_id=$3 and k.enabled;
  if signing_key is null or extensions.hmac(convert_to(request_text,'UTF8'),signing_key,'sha256') <> decode(signature,'hex') then
    raise exception 'GATEWAY_ATTESTATION_REQUIRED' using errcode='42501';
  end if;
  req := request_text::jsonb;
  calendar := req->'calendarGuard';
  if req->>'domain' is distinct from 'trainoracle.account-journal.gateway.v1'
    or req->>'ownerId' is distinct from owner_id::text or req->>'action' is distinct from 'planCommit'
    or not public.account_plan_exact(calendar,array['today','timeZone'])
    or jsonb_typeof(calendar->'today') is distinct from 'string'
    or calendar->>'today' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or jsonb_typeof(calendar->'timeZone') is distinct from 'string'
    or not exists(select 1 from pg_timezone_names where name=calendar->>'timeZone') then
    raise exception 'INVALID_CALENDAR_GUARD' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  perform public.account_journal_lifecycle_owner();
  stripped := (req-'calendarGuard')::text;
  stripped_signature := encode(extensions.hmac(convert_to(stripped,'UTF8'),signing_key,'sha256'),'hex');
  -- Old receipts settle the exact committed operation, even after its calendar day has passed.
  if exists(select 1 from public.account_plan_collection_receipts r
    where r.user_id=owner_id and r.operation_id=(req->>'operationId')::uuid) then
    return public.mutate_account_plan_replan_attested(stripped,stripped_signature,key_id);
  end if;
  if to_char(clock_timestamp() at time zone (calendar->>'timeZone'),'YYYY-MM-DD') is distinct from calendar->>'today' then
    raise exception 'PLAN_DATE_CHANGED' using errcode='PT409';
  end if;
  result := public.mutate_account_plan_replan_attested(stripped,stripped_signature,key_id);
  -- A date rollover during nested validation rolls back the new index and receipt together.
  if result->>'kind'='committed'
    and to_char(clock_timestamp() at time zone (calendar->>'timeZone'),'YYYY-MM-DD') is distinct from calendar->>'today' then
    raise exception 'PLAN_DATE_CHANGED' using errcode='PT409';
  end if;
  return result;
end;
$$;
revoke all on function public.mutate_account_plan_catalog_replacement_attested(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.mutate_account_plan_catalog_replacement_attested(text,text,text) to authenticated;
commit;
