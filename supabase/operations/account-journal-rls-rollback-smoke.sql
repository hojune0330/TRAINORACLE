-- Synthetic role/RLS rehearsal only, NOT a real JWT/Edge/browser test.
-- All identities, ciphertext fixtures and flag changes roll back together.
-- The fixed synthetic envelope does not claim valid AES encryption.
-- Requires existing operational review; this script never creates or approves evidence.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); target uuid; sid uuid;
begin
  if public.account_storage_operations_ready() is distinct from true then
    raise exception 'REHEARSAL_OPERATIONS_REVIEW_REQUIRED';
  end if;
  update public.service_feature_controls set enabled=true
    where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','AUTH_OAUTH');
  perform set_config('trainoracle.rehearsal_a', a::text, true);
  perform set_config('trainoracle.rehearsal_b', b::text, true);
  foreach target in array array[a,b] loop
    insert into auth.users(id, aud, role, email, created_at, updated_at, email_confirmed_at)
      values(target,'authenticated','authenticated',target::text || '@example.invalid',clock_timestamp(),clock_timestamp(),clock_timestamp());
    sid := gen_random_uuid();
    insert into auth.sessions(id,user_id,not_after) values(sid,target,clock_timestamp()+interval '1 hour');
    perform set_config(case when target=a then 'trainoracle.rehearsal_session_a' else 'trainoracle.rehearsal_session_b' end,sid::text,true);
    insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
      values(target,'1990-01-01','2026-10-05','2026-10-05',clock_timestamp());
    insert into public.beta_enrollments(user_id) values(target);
    perform set_config('request.jwt.claim.sub',target::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',target,'role','authenticated',
      'session_id',sid,'exp',extract(epoch from clock_timestamp())::bigint+600,
      'amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from clock_timestamp())::bigint)))::text,true);
    perform public.set_account_storage_consent(target,sid,0,'2026-10-05',true,true);
  end loop;
  insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload)
    values(a,gen_random_uuid(),1,jsonb_build_object('version',1,'algorithm','AES-GCM','keyId','SYNTHETIC_ONLY',
      'iv','AAAAAAAAAAAAAAAA','ciphertext','AAAAAAAAAAAAAAAAAAAAAA=='));
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated',
    'session_id',current_setting('trainoracle.rehearsal_session_a'),
    'exp',extract(epoch from clock_timestamp())::bigint+600,
    'amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from clock_timestamp())::bigint)))::text,true);
end $$;
set local role authenticated;
do $$ begin
  if (select count(*) from public.account_journal_documents) <> 1 then
    raise exception 'REHEARSAL_OWNER_READ_FAILED';
  end if;
  begin
    perform 1 from public.account_journal_gateway_keys;
    raise exception 'REHEARSAL_PRIVATE_KEY_ACCESS';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ declare b text := current_setting('trainoracle.rehearsal_b'); begin
  perform set_config('request.jwt.claim.sub',b,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated',
    'session_id',current_setting('trainoracle.rehearsal_session_b'),
    'exp',extract(epoch from clock_timestamp())::bigint+600,
    'amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from clock_timestamp())::bigint)))::text,true);
end $$;
set local role authenticated;
do $$ begin
  if (select count(*) from public.account_journal_documents) <> 0 then
    raise exception 'REHEARSAL_FOREIGN_OWNER_VISIBLE';
  end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.account_journal_documents;
    raise exception 'REHEARSAL_ANONYMOUS_ACCESS';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'SYNTHETIC_RLS_ROLLED_BACK' as result;
