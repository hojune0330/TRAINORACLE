begin;

update public.service_feature_controls
set enabled = true,
    change_reason = 'TRIAL_TRANSACTION_ONLY',
    revision = revision + 1,
    updated_at = clock_timestamp()
where feature_key in ('ACCOUNT', 'SYNC');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'trial-a@example.invalid', clock_timestamp(), clock_timestamp()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'trial-b@example.invalid', clock_timestamp(), clock_timestamp()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'trial-child@example.invalid', clock_timestamp(), clock_timestamp());

set local role authenticated;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare
  result text;
begin
  select public.claim_beta_seat((current_date - interval '20 years')::date) into result;
  if result <> 'ADMITTED_NEW' then
    raise exception 'adult A beta admission failed: %', result;
  end if;
end;
$$;

insert into public.journal_entries (user_id, entry_id, saved_at, entry)
values (
  '11111111-1111-4111-8111-111111111111',
  'trial-a-entry',
  '2026-08-02T00:00:00.000Z',
  '{"kind":"training"}'::jsonb
);

insert into public.encrypted_private_notes (user_id, entry_id, encrypted_payload, saved_at)
values (
  '11111111-1111-4111-8111-111111111111',
  'trial-a-entry',
  '{"ciphertext":"synthetic-only"}'::jsonb,
  clock_timestamp()
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

do $$
declare
  result text;
  visible_journals integer;
  visible_private_notes integer;
begin
  select public.claim_beta_seat((current_date - interval '20 years')::date) into result;
  if result <> 'ADMITTED_NEW' then
    raise exception 'adult B beta admission failed: %', result;
  end if;

  select count(*) into visible_journals from public.journal_entries;
  if visible_journals <> 0 then
    raise exception 'cross-account journal leak: % rows', visible_journals;
  end if;

  select count(*) into visible_private_notes from public.encrypted_private_notes;
  if visible_private_notes <> 0 then
    raise exception 'cross-account private-note leak: % rows', visible_private_notes;
  end if;

  if public.first_link_guardian_requirement_met(
    '11111111-1111-4111-8111-111111111111',
    null,
    current_date
  ) then
    raise exception 'cross-account guardian age status leaked';
  end if;

  if not public.first_link_guardian_requirement_met(
    '22222222-2222-4222-8222-222222222222',
    null,
    current_date
  ) then
    raise exception 'own adult guardian requirement check failed';
  end if;

  begin
    insert into public.journal_entries (user_id, entry_id, saved_at, entry)
    values (
      '11111111-1111-4111-8111-111111111111',
      'forbidden-cross-account-entry',
      '2026-08-02T00:00:00.000Z',
      '{}'::jsonb
    );
    raise exception 'cross-account insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

insert into public.journal_entries (user_id, entry_id, saved_at, entry)
values (
  '22222222-2222-4222-8222-222222222222',
  'trial-b-entry',
  '2026-08-02T00:00:00.000Z',
  '{"kind":"training"}'::jsonb
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

do $$
declare
  result text;
begin
  select public.claim_beta_seat((current_date - interval '10 years')::date) into result;
  if result <> 'ADMITTED_NEW' then
    raise exception 'minor beta admission failed: %', result;
  end if;

  if public.account_network_access_allowed('33333333-3333-4333-8333-333333333333') then
    raise exception 'minor network access opened without guardian confirmation';
  end if;

  begin
    insert into public.journal_entries (user_id, entry_id, saved_at, entry)
    values (
      '33333333-3333-4333-8333-333333333333',
      'forbidden-minor-entry',
      '2026-08-02T00:00:00.000Z',
      '{}'::jsonb
    );
    raise exception 'minor insert unexpectedly succeeded without guardian confirmation';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare
  visible_journals integer;
  requested_at timestamptz;
begin
  select count(*) into visible_journals from public.journal_entries;
  if visible_journals <> 1 then
    raise exception 'adult A own-row visibility mismatch before deletion: %', visible_journals;
  end if;

  select public.request_account_deletion() into requested_at;
  if requested_at is null then
    raise exception 'account deletion request did not return a timestamp';
  end if;

  select count(*) into visible_journals from public.journal_entries;
  if visible_journals <> 0 then
    raise exception 'deleted account retained journal access: % rows', visible_journals;
  end if;
end;
$$;

reset role;

do $$
declare
  unsafe_columns integer;
begin
  select count(*) into unsafe_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'product_analytics_events'
    and column_name in ('entry', 'note', 'memo', 'pain', 'mood', 'body_state');

  if unsafe_columns <> 0 then
    raise exception 'analytics table contains sensitive payload columns';
  end if;
end;
$$;

rollback;

select 'PASS' as trial_rls_rehearsal,
       'cross-account, guardian boundary, deletion, analytics, rollback' as verified_boundaries;
