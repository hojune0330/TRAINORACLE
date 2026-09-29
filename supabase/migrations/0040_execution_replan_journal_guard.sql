-- No new data table, grants on athlete data, or plaintext health payload.
begin;
create function public.mutate_account_plan_replan_attested(request_text text, signature text, key_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  owner_id uuid := public.account_journal_lifecycle_owner();
  signing_key bytea; req jsonb; expected jsonb; actual jsonb; stripped text; stripped_signature text;
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
  if req->>'domain' is distinct from 'trainoracle.account-journal.gateway.v1'
    or req->>'ownerId' is distinct from owner_id::text or req->>'action' is distinct from 'planCommit'
    or jsonb_typeof(req->'journalGuard') is distinct from 'array'
    or jsonb_array_length(req->'journalGuard')>5000 then
    raise exception 'INVALID_REPLAN_GUARD' using errcode='22023';
  end if;
  -- The same owner lock is held by journal create/edit/delete and plan commits.
  perform pg_advisory_xact_lock(hashtextextended('account_journal_v2:' || owner_id::text,0));
  perform public.account_journal_lifecycle_owner();
  stripped := (req-'journalGuard')::text;
  stripped_signature := encode(extensions.hmac(convert_to(stripped,'UTF8'),signing_key,'sha256'),'hex');
  -- An existing receipt answers a lost ACK even when journals changed afterwards.
  if exists(select 1 from public.account_plan_collection_receipts r
    where r.user_id=owner_id and r.operation_id=(req->>'operationId')::uuid) then
    return public.mutate_account_plan_collection_attested(stripped,stripped_signature,key_id);
  end if;
  if exists(select 1 from jsonb_array_elements(req->'journalGuard') v
    where not public.account_plan_exact(v,array['documentId','revision'])
      or jsonb_typeof(v->'documentId') is distinct from 'string'
      or v->>'documentId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      or jsonb_typeof(v->'revision') is distinct from 'number'
      or v->>'revision' !~ '^[1-9][0-9]{0,15}$') then
    raise exception 'INVALID_REPLAN_GUARD' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(v order by v->>'documentId'),'[]'::jsonb) into expected from jsonb_array_elements(req->'journalGuard') v;
  select coalesce(jsonb_agg(jsonb_build_object('documentId',d.document_id,'revision',d.revision) order by d.document_id::text),'[]'::jsonb)
    into actual from public.account_journal_documents d
    join public.account_journal_identity i on i.user_id=d.user_id and i.document_id=d.document_id
    where d.user_id=owner_id and d.deleted_at is null and i.document_kind='JOURNAL';
  if expected is distinct from actual then return jsonb_build_object('kind','conflict'); end if;
  -- Original routine validates expiry, CAS, immutable history, index and receipt binding.
  return public.mutate_account_plan_collection_attested(stripped,stripped_signature,key_id);
end;
$$;
revoke all on function public.mutate_account_plan_replan_attested(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.mutate_account_plan_replan_attested(text,text,text) to authenticated;
commit;
