-- Public-profile rows outlive a disabled feature or a deletion request so they
-- can be recovered or purged safely. Their RLS policies must therefore check
-- the current account lifecycle on every read rather than trusting is_public
-- or auth.uid() alone.
begin;

create or replace function public.account_subject_public_data_allowed(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select target_user is not null
    and public.service_feature_enabled('ACCOUNT') is true
    and public.public_profile_sharing_enabled() is true
    and exists (
      select 1
      from public.public_athlete_profiles public_profile
      where public_profile.user_id = target_user
        and public_profile.is_public
    )
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

revoke all on function public.account_subject_public_data_allowed(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.account_subject_public_data_allowed(uuid)
  to anon, authenticated, service_role;

-- Date of birth and legal-consent metadata are private even though the table
-- still has direct SELECT permission for authenticated clients.
drop policy if exists "own private profile select" on public.user_private_profiles;
create policy "admitted private profile select" on public.user_private_profiles
  for select to authenticated using (public.account_network_access_allowed(user_id));

drop policy if exists "public or own athlete profile select" on public.public_athlete_profiles;
create policy "admitted owner athlete profile select" on public.public_athlete_profiles
  for select to authenticated using (public.account_network_access_allowed(user_id));
create policy "current public athlete profile select" on public.public_athlete_profiles
  for select to anon, authenticated using (
    is_public
    and public.public_profile_sharing_enabled()
    and public.account_subject_public_data_allowed(user_id)
  );

drop policy if exists "public or own plan card select" on public.public_plan_share_cards;
create policy "admitted owner plan card select" on public.public_plan_share_cards
  for select to authenticated using (public.account_network_access_allowed(user_id));
create policy "current public plan card select" on public.public_plan_share_cards
  for select to anon, authenticated using (
    is_public
    and public.public_profile_sharing_enabled()
    and public.account_subject_public_data_allowed(user_id)
    and exists (
      select 1
      from public.public_athlete_profiles profile
      where profile.user_id = public_plan_share_cards.user_id
        and profile.is_public
    )
  );

drop policy if exists "public or own oracle comparison select" on public.public_oracle_comparison_snapshots;
create policy "admitted owner oracle comparison select" on public.public_oracle_comparison_snapshots
  for select to authenticated using (public.account_network_access_allowed(user_id));
create policy "current public oracle comparison select" on public.public_oracle_comparison_snapshots
  for select to anon, authenticated using (
    is_enabled
    and public.public_profile_sharing_enabled()
    and public.account_subject_public_data_allowed(user_id)
    and exists (
      select 1
      from public.public_athlete_profiles profile
      where profile.user_id = public_oracle_comparison_snapshots.user_id
        and profile.is_public
    )
  );

commit;
