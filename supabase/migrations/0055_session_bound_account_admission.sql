-- Finishing account setup must use the exact Supabase Auth session that
-- completed the verified sign-in flow. User identity alone is insufficient:
-- the same user can hold multiple browser sessions with different origins.
begin;

-- Keep the former writing signature callable only as an explicit upgrade
-- response. This prevents an older or modified client from bypassing the new
-- session-bound overload while avoiding an ambiguous PostgREST function miss.
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
begin
  perform set_config('response.headers', '[{"Cache-Control":"no-store"}]', true);
  if auth.uid() is null or auth.jwt() ->> 'role' is distinct from 'authenticated' then
    return 'LOGIN_REQUIRED';
  end if;
  if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
  end if;
  return 'CLIENT_UPDATE_REQUIRED';
end;
$$;

create or replace function public.claim_beta_seat(
  expected_user_id_input uuid,
  expected_session_id_input uuid,
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
  current_session_id uuid;
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
  if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
  end if;
  if expected_user_id_input is null or actor is distinct from expected_user_id_input then
    return 'IDENTITY_MISMATCH';
  end if;

  begin
    current_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception
    when others then
      return 'SESSION_MISMATCH';
  end;
  if expected_session_id_input is null
    or current_session_id is distinct from expected_session_id_input then
    return 'SESSION_MISMATCH';
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

revoke all on function public.claim_beta_seat(uuid, date, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_beta_seat(uuid, uuid, date, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_beta_seat(uuid, date, text, text)
  to authenticated;
grant execute on function public.claim_beta_seat(uuid, uuid, date, text, text)
  to authenticated;

comment on function public.claim_beta_seat(uuid, uuid, date, text, text) is
  'Session-bound account admission. The expected session must match the current signed JWT session before any account row is written.';

commit;
