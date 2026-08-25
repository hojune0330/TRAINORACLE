-- Rollback-only staging rehearsal for migrations 0001..0028.
-- It creates synthetic auth users inside one transaction and leaves no rows behind.
begin;

update public.service_feature_controls
set enabled = true,
    change_reason = 'ACCOUNT_ISOLATION_REHEARSAL_TRANSACTION_ONLY',
    revision = revision + 1,
    updated_at = clock_timestamp()
where feature_key in ('ACCOUNT', 'SYNC');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'isolation-a@example.invalid', clock_timestamp(), clock_timestamp()),
  ('b2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'isolation-b@example.invalid', clock_timestamp(), clock_timestamp()),
  ('c3333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'isolation-under14@example.invalid', clock_timestamp(), clock_timestamp());

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare
  result text;
begin
  select public.claim_beta_seat(
    ((clock_timestamp() at time zone 'Asia/Seoul')::date - interval '20 years')::date,
    'isolation-test-v1',
    'isolation-test-v1'
  ) into result;
  if result <> 'ADMITTED_NEW' then
    raise exception 'account A admission failed: %', result;
  end if;
end;
$$;

insert into public.journal_entries (user_id, entry_id, saved_at, entry)
values (
  'a1111111-1111-4111-8111-111111111111',
  'isolation-a-entry',
  clock_timestamp(),
  '{"kind":"training","memo":null}'::jsonb
);

do $$
begin
  if (select count(*) from public.user_private_profiles) <> 1 then
    raise exception 'account A cannot see exactly one own profile';
  end if;
  if (select count(*) from public.journal_entries) <> 1 then
    raise exception 'account A cannot see exactly one own journal';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

do $$
declare
  result text;
  changed_rows integer;
begin
  select public.claim_beta_seat(
    ((clock_timestamp() at time zone 'Asia/Seoul')::date - interval '19 years')::date,
    'isolation-test-v1',
    'isolation-test-v1'
  ) into result;
  if result <> 'ADMITTED_NEW' then
    raise exception 'account B admission failed: %', result;
  end if;

  if (select count(*) from public.user_private_profiles) <> 1 then
    raise exception 'account B profile visibility leaked across accounts';
  end if;
  if (select count(*) from public.journal_entries) <> 0 then
    raise exception 'account B can read account A journal';
  end if;

  begin
    update public.user_private_profiles
    set analytics_opt_in = true
    where user_id = 'a1111111-1111-4111-8111-111111111111';
    get diagnostics changed_rows = row_count;
    if changed_rows <> 0 then
      raise exception 'account B updated account A profile';
    end if;
  exception
    -- Direct profile writes are currently revoked. If that boundary changes,
    -- the RLS path above must still reject cross-account updates with zero rows.
    when insufficient_privilege then null;
  end;

  begin
    insert into public.journal_entries (user_id, entry_id, saved_at, entry)
    values (
      'a1111111-1111-4111-8111-111111111111',
      'forbidden-cross-account-entry',
      clock_timestamp(),
      '{}'::jsonb
    );
    raise exception 'account B inserted as account A';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

insert into public.journal_entries (user_id, entry_id, saved_at, entry)
values (
  'b2222222-2222-4222-8222-222222222222',
  'isolation-b-entry',
  clock_timestamp(),
  '{"kind":"training","memo":null}'::jsonb
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.journal_entries) <> 1 then
    raise exception 'account A visibility changed after account B write';
  end if;
  if exists (
    select 1 from public.journal_entries
    where user_id = 'b2222222-2222-4222-8222-222222222222'
  ) then
    raise exception 'account A can read account B journal';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'c3333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claims', '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

do $$
declare
  blocked boolean := false;
begin
  begin
    perform public.claim_beta_seat(
      ((clock_timestamp() at time zone 'Asia/Seoul')::date - interval '13 years')::date,
      'isolation-test-v1',
      'isolation-test-v1'
    );
  exception
    when invalid_parameter_value then
      blocked := true;
  end;
  if not blocked then
    raise exception 'under-14 online profile was not blocked';
  end if;
end;
$$;

reset role;
rollback;

select 'PASS' as account_identity_isolation_rehearsal,
       'two-account profile and journal isolation, cross-write rejection, under-14 server gate, rollback' as verified_boundaries;
