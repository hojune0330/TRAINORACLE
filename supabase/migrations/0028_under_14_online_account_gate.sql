-- First-wave public accounts are offered only to people who are at least 14.
-- The client asks before authentication; this trigger is the server-side backstop
-- for bypassed or stale clients. Existing rows are not deleted by this migration.

create or replace function public.block_under_14_online_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birth_date > (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years' then
    raise exception 'under 14 online account not offered' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists user_private_profiles_under_14_gate on public.user_private_profiles;
create trigger user_private_profiles_under_14_gate
before insert or update of birth_date on public.user_private_profiles
for each row execute function public.block_under_14_online_profile();

revoke all on function public.block_under_14_online_profile() from public;
revoke all on function public.block_under_14_online_profile() from anon;
revoke all on function public.block_under_14_online_profile() from authenticated;

-- Existing private profiles are retained for audit/deletion handling, but the
-- first-wave product must not grant them journal sync or sharing while under 14.
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
        and profile.birth_date <= (clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years'
        and profile.deletion_requested_at is null
        and profile.privacy_policy_version is not null
        and profile.terms_of_service_version is not null
        and profile.legal_consented_at is not null
    )
    and public.athlete_support_access_allowed(target_user);
$$;
