-- The public-account feature remains off unless the client has public document URLs.
-- When it is opened, record only the approved document versions and a server time.

alter table public.user_private_profiles
  add column if not exists privacy_policy_version text,
  add column if not exists terms_of_service_version text,
  add column if not exists legal_consented_at timestamptz;

alter table public.user_private_profiles
  drop constraint if exists user_private_profiles_legal_consent_check;

alter table public.user_private_profiles
  add constraint user_private_profiles_legal_consent_check check (
    (privacy_policy_version is null and terms_of_service_version is null and legal_consented_at is null)
    or (
      privacy_policy_version is not null
      and terms_of_service_version is not null
      and legal_consented_at is not null
    )
  );

-- Keep the former RPC callable for an old client, but never let it reserve a seat.
create or replace function public.claim_beta_seat(birth_date_input date)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  return 'CONSENT_REQUIRED';
end;
$$;

create or replace function public.claim_beta_seat(
  birth_date_input date,
  privacy_policy_version_input text,
  terms_of_service_version_input text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  capacity_limit integer;
  occupied_seats integer;
  consent_time timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if birth_date_input is null or birth_date_input > current_date then
    raise exception 'invalid birth date';
  end if;
  if coalesce(btrim(privacy_policy_version_input), '') = ''
    or coalesce(btrim(terms_of_service_version_input), '') = ''
    or char_length(privacy_policy_version_input) > 80
    or char_length(terms_of_service_version_input) > 80 then
    raise exception 'invalid legal consent version';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests request
    where request.user_id = auth.uid()
  ) then
    return 'ACCOUNT_BLOCKED';
  end if;

  select capacity.seat_limit
  into capacity_limit
  from public.beta_capacity_controls capacity
  where capacity.capacity_key = 'PUBLIC_BETA'
  for update;

  if capacity_limit is null then
    raise exception 'beta capacity is not configured';
  end if;

  if exists (
    select 1
    from public.beta_enrollments enrollment
    where enrollment.user_id = auth.uid()
  ) then
    insert into public.user_private_profiles (
      user_id,
      birth_date,
      privacy_policy_version,
      terms_of_service_version,
      legal_consented_at,
      updated_at
    )
    values (
      auth.uid(),
      birth_date_input,
      privacy_policy_version_input,
      terms_of_service_version_input,
      consent_time,
      consent_time
    )
    on conflict (user_id) do update
    set birth_date = excluded.birth_date,
        privacy_policy_version = excluded.privacy_policy_version,
        terms_of_service_version = excluded.terms_of_service_version,
        legal_consented_at = excluded.legal_consented_at,
        updated_at = excluded.updated_at
    where user_private_profiles.deletion_requested_at is null;
    return 'ADMITTED_EXISTING';
  end if;

  select count(*)
  into occupied_seats
  from public.beta_enrollments;

  if occupied_seats >= capacity_limit then
    return 'BETA_FULL';
  end if;

  insert into public.beta_enrollments (user_id)
  values (auth.uid());

  insert into public.user_private_profiles (
    user_id,
    birth_date,
    privacy_policy_version,
    terms_of_service_version,
    legal_consented_at,
    updated_at
  )
  values (
    auth.uid(),
    birth_date_input,
    privacy_policy_version_input,
    terms_of_service_version_input,
    consent_time,
    consent_time
  )
  on conflict (user_id) do update
  set birth_date = excluded.birth_date,
      privacy_policy_version = excluded.privacy_policy_version,
      terms_of_service_version = excluded.terms_of_service_version,
      legal_consented_at = excluded.legal_consented_at,
      updated_at = excluded.updated_at
  where user_private_profiles.deletion_requested_at is null;

  return 'ADMITTED_NEW';
end;
$$;

revoke all on function public.claim_beta_seat(date) from public;
revoke all on function public.claim_beta_seat(date) from anon;
revoke all on function public.claim_beta_seat(date) from authenticated;
grant execute on function public.claim_beta_seat(date) to authenticated;

revoke all on function public.claim_beta_seat(date, text, text) from public;
revoke all on function public.claim_beta_seat(date, text, text) from anon;
revoke all on function public.claim_beta_seat(date, text, text) from authenticated;
grant execute on function public.claim_beta_seat(date, text, text) to authenticated;

create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select auth.uid() = target_user
    and exists (
      select 1
      from public.beta_enrollments enrollment
      join public.user_private_profiles profile on profile.user_id = enrollment.user_id
      where enrollment.user_id = target_user
        and profile.deletion_requested_at is null
        and profile.privacy_policy_version is not null
        and profile.terms_of_service_version is not null
        and profile.legal_consented_at is not null
    )
    and public.athlete_support_access_allowed(target_user);
$$;
