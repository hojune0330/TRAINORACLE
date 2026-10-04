-- A Supabase identity is not, by itself, an admitted TrainOracle account.
-- Keep the admission decision server-authoritative and return only a narrow
-- status for the current caller. No birth date, legal version, or profile data
-- leaves these functions.
begin;

-- The former helper chain rechecked age with the database session timezone.
-- At the exact 14th birthday that could disagree with the required KST day.
-- Make the canonical network gate self-contained, KST-bound, and subject to
-- the same account kill switch used by admission.
create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select auth.uid() = target_user
    and public.service_feature_enabled('ACCOUNT') is true
    and exists (
      select 1
      from public.beta_enrollments enrollment
      join public.user_private_profiles profile on profile.user_id = enrollment.user_id
      where enrollment.user_id = target_user
        and profile.birth_date <= (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'
        and profile.deletion_requested_at is null
        and profile.privacy_policy_version = '2026-08-26'
        and profile.terms_of_service_version = '2026-08-26'
        and profile.legal_consented_at is not null
        and profile.legal_consented_at <= clock_timestamp()
    )
    and not exists (
      select 1
      from public.account_deletion_requests request
      where request.user_id = target_user
    );
$$;
revoke all on function public.account_network_access_allowed(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.account_network_access_allowed(uuid) to authenticated, service_role;

-- Old clients do not bind the profile claim to the user id they observed.
-- Keep their RPC shapes callable only so they fail closed with a stable result;
-- neither compatibility function can create or update an account profile.
create or replace function public.claim_beta_seat(birth_date_input date)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);
  if auth.uid() is null then
    return 'LOGIN_REQUIRED';
  end if;
  return 'CLIENT_UPDATE_REQUIRED';
end;
$$;

create or replace function public.claim_beta_seat(
  birth_date_input date,
  privacy_policy_version_input text,
  terms_of_service_version_input text
)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);
  if auth.uid() is null then
    return 'LOGIN_REQUIRED';
  end if;
  return 'CLIENT_UPDATE_REQUIRED';
end;
$$;

create or replace function public.claim_beta_seat(
  expected_user_id_input uuid,
  birth_date_input date,
  privacy_policy_version_input text,
  terms_of_service_version_input text
)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  capacity_limit integer;
  occupied_seats integer;
  consent_time timestamptz := clock_timestamp();
  service_date date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  existing_birth_date date;
  existing_deletion_requested_at timestamptz;
  profile_exists boolean := false;
  already_enrolled boolean := false;
  affected_rows integer := 0;
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);

  if actor is null or auth.jwt() ->> 'role' is distinct from 'authenticated' then
    return 'LOGIN_REQUIRED';
  end if;
  -- The caller-observed user id and the database JWT identity must agree in
  -- this same transaction. A stale client response cannot claim another user.
  if expected_user_id_input is null or actor is distinct from expected_user_id_input then
    return 'IDENTITY_MISMATCH';
  end if;
  if public.service_feature_enabled('ACCOUNT') is distinct from true then
    return 'ACCOUNT_FEATURE_DISABLED';
  end if;
  if birth_date_input is null or birth_date_input > service_date then
    return 'INVALID_BIRTH_DATE';
  end if;
  if birth_date_input > service_date - interval '14 years' then
    return 'UNDER_14_NOT_ELIGIBLE';
  end if;
  if privacy_policy_version_input is distinct from '2026-08-26'
    or terms_of_service_version_input is distinct from '2026-08-26' then
    return 'LEGAL_VERSION_INVALID';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests request
    where request.user_id = actor
  ) then
    return 'ACCOUNT_BLOCKED';
  end if;

  -- The singleton capacity row serializes both first claims and retries. It
  -- prevents two concurrent requests for the same identity from observing an
  -- incomplete profile/enrollment pair.
  select capacity.seat_limit
  into capacity_limit
  from public.beta_capacity_controls capacity
  where capacity.capacity_key = 'PUBLIC_BETA'
  for update;

  if capacity_limit is null then
    return 'CAPACITY_NOT_CONFIGURED';
  end if;

  select profile.birth_date, profile.deletion_requested_at
  into existing_birth_date, existing_deletion_requested_at
  from public.user_private_profiles profile
  where profile.user_id = actor
  for update;
  profile_exists := found;

  if profile_exists and existing_deletion_requested_at is not null then
    return 'ACCOUNT_BLOCKED';
  end if;
  -- Birth date is an account identity attribute. Re-consent can refresh legal
  -- versions, but a login retry must never silently rewrite the saved date.
  if profile_exists and existing_birth_date is distinct from birth_date_input then
    return 'BIRTH_DATE_MISMATCH';
  end if;

  select exists (
    select 1
    from public.beta_enrollments enrollment
    where enrollment.user_id = actor
  ) into already_enrolled;

  if already_enrolled then
    if not profile_exists then
      return 'PROFILE_INCONSISTENT';
    end if;
    update public.user_private_profiles
    set privacy_policy_version = privacy_policy_version_input,
        terms_of_service_version = terms_of_service_version_input,
        legal_consented_at = consent_time,
        updated_at = consent_time
    where user_id = actor
      and birth_date = birth_date_input
      and deletion_requested_at is null;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      return 'ACCOUNT_BLOCKED';
    end if;
    return 'ADMITTED_EXISTING';
  end if;

  select count(*)
  into occupied_seats
  from public.beta_enrollments;

  if occupied_seats >= capacity_limit then
    return 'BETA_FULL';
  end if;

  insert into public.beta_enrollments (user_id)
  values (actor);

  if profile_exists then
    update public.user_private_profiles
    set privacy_policy_version = privacy_policy_version_input,
        terms_of_service_version = terms_of_service_version_input,
        legal_consented_at = consent_time,
        updated_at = consent_time
    where user_id = actor
      and birth_date = birth_date_input
      and deletion_requested_at is null;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'profile changed during admission' using errcode = '40001';
    end if;
  else
    insert into public.user_private_profiles (
      user_id,
      birth_date,
      privacy_policy_version,
      terms_of_service_version,
      legal_consented_at,
      updated_at
    ) values (
      actor,
      birth_date_input,
      privacy_policy_version_input,
      terms_of_service_version_input,
      consent_time,
      consent_time
    );
  end if;

  return 'ADMITTED_NEW';
end;
$$;

revoke all on function public.claim_beta_seat(date) from public, anon, authenticated, service_role;
revoke all on function public.claim_beta_seat(date, text, text) from public, anon, authenticated, service_role;
revoke all on function public.claim_beta_seat(uuid, date, text, text) from public, anon, authenticated, service_role;
grant execute on function public.claim_beta_seat(date) to authenticated;
grant execute on function public.claim_beta_seat(date, text, text) to authenticated;
grant execute on function public.claim_beta_seat(uuid, date, text, text) to authenticated;

-- Deletion is identity-bound in the same transaction too. The former no-arg
-- function is revoked instead of delegated, so a server-first maintenance
-- rollout makes an old client fail closed until the matching client is live.
create or replace function public.request_account_deletion(expected_user_id_input uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  requested timestamptz := clock_timestamp();
  recorded timestamptz;
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);
  if actor is null or auth.jwt() ->> 'role' is distinct from 'authenticated' then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if expected_user_id_input is null or actor is distinct from expected_user_id_input then
    raise exception 'authenticated user mismatch' using errcode = '42501';
  end if;

  insert into public.account_deletion_requests (
    user_id,
    requested_at,
    access_blocked_at,
    delete_by,
    status
  ) values (
    actor,
    requested,
    requested,
    requested + interval '30 days',
    'REQUESTED'
  )
  on conflict (user_id) do nothing;

  select request.requested_at into recorded
  from public.account_deletion_requests request
  where request.user_id = actor;
  return recorded;
end;
$$;

revoke all on function public.request_account_deletion()
  from public, anon, authenticated, service_role;
revoke all on function public.request_account_deletion(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.request_account_deletion(uuid) to authenticated;

create or replace function public.get_current_account_admission_status(expected_user_id_input uuid)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  profile public.user_private_profiles%rowtype;
  now_at timestamptz := clock_timestamp();
  service_date date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);

  if actor is null or auth.jwt() ->> 'role' is distinct from 'authenticated' then
    return 'LOGIN_REQUIRED';
  end if;
  if expected_user_id_input is null or actor is distinct from expected_user_id_input then
    return 'IDENTITY_MISMATCH';
  end if;
  if public.service_feature_enabled('ACCOUNT') is distinct from true then
    return 'ACCOUNT_DISABLED';
  end if;
  if exists (
    select 1 from public.account_deletion_requests request
    where request.user_id = actor
  ) then
    return 'DELETION_REQUESTED';
  end if;

  select candidate.* into profile
  from public.user_private_profiles candidate
  where candidate.user_id = actor;
  if not found then
    return 'NEEDS_PROFILE';
  end if;
  if profile.deletion_requested_at is not null then
    return 'DELETION_REQUESTED';
  end if;
  if profile.birth_date > service_date - interval '14 years' then
    return 'UNDER_14';
  end if;
  if profile.privacy_policy_version is distinct from '2026-08-26'
    or profile.terms_of_service_version is distinct from '2026-08-26'
    or profile.legal_consented_at is null
    or profile.legal_consented_at > now_at then
    return 'LEGAL_RECONSENT_REQUIRED';
  end if;
  if not exists (
    select 1 from public.beta_enrollments enrollment
    where enrollment.user_id = actor
  ) then
    return 'BETA_NOT_ENROLLED';
  end if;
  if public.account_network_access_allowed(actor) is distinct from true then
    return 'RESTRICTED';
  end if;
  return 'ADMITTED';
end;
$$;

revoke all on function public.get_current_account_admission_status(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_current_account_admission_status(uuid) to authenticated;

comment on function public.get_current_account_admission_status(uuid) is
  'Current authenticated caller admission only; returns a narrow status and no profile or identity metadata.';

commit;
