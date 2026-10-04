-- A valid Supabase user JWT is not enough to enter TrainOracle. The public
-- account flow supports OAuth and passwordless email only. Keep this policy in
-- PostgreSQL so a stale or modified client cannot enroll or use account data
-- with password, anonymous, recovery, invitation, or email-change sessions.
begin;

-- Browser feature flags are not an authorization boundary because the public
-- Auth API can be called directly. These aggregate server switches are
-- deliberately broader than individual providers: when one OAuth provider is
-- suspect, operators close all OAuth account access until sessions are revoked
-- and the provider incident is understood.
alter table public.service_feature_controls
  drop constraint service_feature_controls_feature_key_check;
alter table public.service_feature_controls
  add constraint service_feature_controls_feature_key_check check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD',
    'PLAN_BACKUP', 'PUBLIC_PROFILE', 'DEVICE_INTEGRATION', 'ACCOUNT_JOURNAL_V2', 'FILE_ANALYSIS_WRITE',
    'AUTH_OAUTH', 'AUTH_PASSWORDLESS'
  ));
alter table public.service_feature_control_events
  drop constraint service_feature_control_events_feature_key_check;
alter table public.service_feature_control_events
  add constraint service_feature_control_events_feature_key_check check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD',
    'PLAN_BACKUP', 'PUBLIC_PROFILE', 'DEVICE_INTEGRATION', 'ACCOUNT_JOURNAL_V2', 'FILE_ANALYSIS_WRITE',
    'AUTH_OAUTH', 'AUTH_PASSWORDLESS'
  ));
insert into public.service_feature_controls(feature_key, enabled, change_reason)
values
  ('AUTH_OAUTH', false, 'INITIAL_SAFE_DEFAULT'),
  ('AUTH_PASSWORDLESS', false, 'INITIAL_SAFE_DEFAULT')
on conflict (feature_key) do nothing;

create or replace function public.current_jwt_session_active()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  session_id_claim uuid;
begin
  if actor is null or auth.jwt() ->> 'role' is distinct from 'authenticated' then
    return false;
  end if;
  session_id_claim := (auth.jwt() ->> 'session_id')::uuid;
  return session_id_claim is not null and exists (
    select 1
    from auth.sessions active_session
    where active_session.id = session_id_claim
      and active_session.user_id = actor
      and (active_session.not_after is null or active_session.not_after > clock_timestamp())
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.current_jwt_session_active()
  from public, anon, authenticated, service_role;

create or replace function public.current_jwt_auth_method_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  methods jsonb := auth.jwt() -> 'amr';
  method_entry jsonb;
  has_supported_origin boolean := false;
  uses_oauth boolean := false;
  uses_passwordless boolean := false;
begin
  if public.current_jwt_session_active() is distinct from true then
    return false;
  end if;

  -- Supabase documents AMR as a non-empty array of objects containing a
  -- string method and numeric Unix timestamp. Missing or malformed claims do
  -- not inherit trust from role=authenticated.
  if jsonb_typeof(methods) is distinct from 'array'
    or jsonb_array_length(methods) = 0 then
    return false;
  end if;

  -- Supabase uses email/signup for both passwordless first signup and a
  -- direct email+password signup followed by confirmation. AMR alone cannot
  -- distinguish them. Deny any current identity that has a password hash,
  -- including a password added after a formerly passwordless signup.
  if auth.uid() is null or exists (
    select 1
    from auth.users candidate
    where candidate.id = auth.uid()
      and nullif(candidate.encrypted_password, '') is not null
  ) then
    return false;
  end if;

  for method_entry in select value from jsonb_array_elements(methods)
  loop
    if jsonb_typeof(method_entry) is distinct from 'object'
      or jsonb_typeof(method_entry -> 'method') is distinct from 'string'
      or jsonb_typeof(method_entry -> 'timestamp') is distinct from 'number' then
      return false;
    end if;

    -- token_refresh is acceptable only alongside the supported method that
    -- originally authenticated the session. It never authorizes by itself.
    if method_entry ->> 'method' not in (
      'oauth',
      'otp',
      'magiclink',
      'email/signup',
      'token_refresh'
    ) then
      return false;
    end if;

    if method_entry ->> 'method' in (
      'oauth',
      'otp',
      'magiclink',
      'email/signup'
    ) then
      has_supported_origin := true;
    end if;
    if method_entry ->> 'method' = 'oauth' then
      uses_oauth := true;
    end if;
    if method_entry ->> 'method' in ('otp', 'magiclink', 'email/signup') then
      uses_passwordless := true;
    end if;
  end loop;

  return has_supported_origin
    and (not uses_oauth or public.service_feature_enabled('AUTH_OAUTH') is true)
    and (not uses_passwordless or public.service_feature_enabled('AUTH_PASSWORDLESS') is true);
exception
  when others then
    return false;
end;
$$;

revoke all on function public.current_jwt_auth_method_allowed()
  from public, anon, authenticated, service_role;

create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select auth.uid() = target_user
    and public.current_jwt_auth_method_allowed() is true
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
  if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
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
  if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
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
  if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
  end if;
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

revoke all on function public.claim_beta_seat(date) from public, anon, authenticated, service_role;
revoke all on function public.claim_beta_seat(date, text, text) from public, anon, authenticated, service_role;
revoke all on function public.claim_beta_seat(uuid, date, text, text) from public, anon, authenticated, service_role;
grant execute on function public.claim_beta_seat(date) to authenticated;
grant execute on function public.claim_beta_seat(date, text, text) to authenticated;
grant execute on function public.claim_beta_seat(uuid, date, text, text) to authenticated;

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
  if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
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

-- Account deletion remains available to any supported Supabase authentication
-- method, including a password session, but not to a JWT whose server session
-- was revoked. This closes the stateless access-token window for the destructive
-- RPC without turning auth-method admission into a barrier to account removal.
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
  if public.current_jwt_session_active() is distinct from true then
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

revoke all on function public.request_account_deletion(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.request_account_deletion(uuid) to authenticated;

comment on function public.current_jwt_auth_method_allowed() is
  'Fail-closed TrainOracle allowlist for current JWT AMR, password-free identity, and aggregate server auth-channel controls.';
comment on function public.current_jwt_session_active() is
  'Current authenticated JWT must still map to its live server-side Supabase Auth session.';

commit;
