-- Rollback-only operational rehearsal. It copies encrypted row shapes without
-- decrypting or returning personal plan data, then removes every synthetic row.
begin;

do $$
begin
  if not exists (select 1 from public.account_plan_collection_indexes) then
    raise exception 'ACCOUNT_PLAN_SOURCE_REQUIRED';
  end if;
  if has_table_privilege('authenticated', 'public.account_plan_collection_indexes', 'select')
    or has_table_privilege('authenticated', 'public.account_plan_collection_parts', 'select')
    or has_table_privilege('authenticated', 'public.account_plan_collection_receipts', 'select') then
    raise exception 'ACCOUNT_PLAN_DIRECT_TABLE_ACCESS_PRESENT';
  end if;
end;
$$;

update public.service_feature_controls
set enabled = true,
    change_reason = 'ACCOUNT_PLAN_ISOLATION_REHEARSAL_TRANSACTION_ONLY',
    revision = revision + 1,
    updated_at = clock_timestamp()
where feature_key in ('ACCOUNT', 'SYNC');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
    'plan-isolation-a@example.invalid', clock_timestamp(), clock_timestamp()),
  ('b2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
    'plan-isolation-b@example.invalid', clock_timestamp(), clock_timestamp());

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public.claim_beta_seat(
  ((clock_timestamp() at time zone 'Asia/Seoul')::date - interval '20 years')::date,
  'plan-isolation-v1', 'plan-isolation-v1');

select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims',
  '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select public.claim_beta_seat(
  ((clock_timestamp() at time zone 'Asia/Seoul')::date - interval '19 years')::date,
  'plan-isolation-v1', 'plan-isolation-v1');
reset role;

with source_owner as (
  select user_id from public.account_plan_collection_indexes order by user_id limit 1
)
insert into public.account_plan_collection_indexes
  (user_id, revision, index_fingerprint, index_document, payload)
select 'a1111111-1111-4111-8111-111111111111', revision, index_fingerprint, index_document, payload
from public.account_plan_collection_indexes
where user_id = (select user_id from source_owner);

with source_owner as (
  select user_id from public.account_plan_collection_indexes
  where user_id <> 'a1111111-1111-4111-8111-111111111111'
  order by user_id limit 1
)
insert into public.account_plan_collection_parts
  (user_id, part_kind, part_id, plan_id, content_hash, payload, metadata)
select 'a1111111-1111-4111-8111-111111111111', part_kind, part_id, plan_id,
  content_hash, payload, metadata
from public.account_plan_collection_parts
where user_id = (select user_id from source_owner);

with source_owner as (
  select user_id from public.account_plan_collection_indexes
  where user_id <> 'a1111111-1111-4111-8111-111111111111'
  order by user_id limit 1
)
insert into public.account_plan_collection_receipts
  (user_id, operation_id, request_fingerprint, request_document, receipt)
select 'a1111111-1111-4111-8111-111111111111', operation_id, request_fingerprint,
  request_document, receipt
from public.account_plan_collection_receipts
where user_id = (select user_id from source_owner);

select set_config('trainoracle.test.part_kind', (
  select part_kind from public.account_plan_collection_parts
  where user_id = 'a1111111-1111-4111-8111-111111111111' order by part_kind, part_id limit 1
), true);
select set_config('trainoracle.test.part_id', (
  select part_id from public.account_plan_collection_parts
  where user_id = 'a1111111-1111-4111-8111-111111111111' order by part_kind, part_id limit 1
), true);
select set_config('trainoracle.test.operation_id', (
  select operation_id::text from public.account_plan_collection_receipts
  where user_id = 'a1111111-1111-4111-8111-111111111111' order by operation_id limit 1
), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims',
  '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
begin
  if public.read_account_plan_collection_index() is not null then
    raise exception 'ACCOUNT_B_READ_ACCOUNT_A_INDEX';
  end if;
  if public.read_account_plan_collection_part(
    current_setting('trainoracle.test.part_kind'), current_setting('trainoracle.test.part_id')) is not null then
    raise exception 'ACCOUNT_B_READ_ACCOUNT_A_PART';
  end if;
  if public.read_account_plan_collection_receipt(
    current_setting('trainoracle.test.operation_id')::uuid) is not null then
    raise exception 'ACCOUNT_B_READ_ACCOUNT_A_RECEIPT';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
begin
  if public.read_account_plan_collection_index() is null then
    raise exception 'ACCOUNT_A_CANNOT_READ_OWN_INDEX';
  end if;
  if public.read_account_plan_collection_part(
    current_setting('trainoracle.test.part_kind'), current_setting('trainoracle.test.part_id')) is null then
    raise exception 'ACCOUNT_A_CANNOT_READ_OWN_PART';
  end if;
  if public.read_account_plan_collection_receipt(
    current_setting('trainoracle.test.operation_id')::uuid) is null then
    raise exception 'ACCOUNT_A_CANNOT_READ_OWN_RECEIPT';
  end if;
end;
$$;

reset role;
rollback;

select 'PASS' as account_plan_production_isolation_rehearsal,
  'two synthetic accounts, owner-only plan reads, direct table access denied, rollback complete'
  as verified_boundaries;
