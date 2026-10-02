-- Admission must use the versions of the documents actually published with the app.
-- When either legal document changes, update both this server gate and the public
-- document/client configuration in the same release. A mismatch fails closed.
begin;

create or replace function public.enforce_current_account_legal_versions()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  -- Profiles without recorded consent remain possible; they do not receive
  -- account-network access. The existing all-or-none constraint still applies.
  if new.privacy_policy_version is null and new.terms_of_service_version is null then
    return new;
  end if;
  if new.privacy_policy_version is distinct from '2026-08-26'
    or new.terms_of_service_version is distinct from '2026-08-26' then
    raise exception 'invalid legal consent version' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists user_private_profiles_current_legal_versions on public.user_private_profiles;
create trigger user_private_profiles_current_legal_versions
before insert or update of privacy_policy_version, terms_of_service_version
on public.user_private_profiles
for each row execute function public.enforce_current_account_legal_versions();

revoke all on function public.enforce_current_account_legal_versions()
  from public, anon, authenticated;

-- Previously accepted arbitrary strings must not continue to authorize
-- network access. They remain on the private profile for audit and can be
-- replaced only through a fresh claim with the current documents.
create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select auth.uid() = target_user
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
    )
    and public.athlete_support_access_allowed(target_user);
$$;

commit;
