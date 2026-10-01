-- Minimal, current-user-only bridge to the shared lounge. No diary, athlete,
-- email, birth date, or private profile field leaves this function.
-- Deployment is not activation: an operator must bind the approved CURRENT
-- legal document versions and enable this dedicated gate after rehearsal.
create table public.lounge_admission_controls (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  privacy_policy_version text,
  terms_of_service_version text,
  check (privacy_policy_version is null or length(btrim(privacy_policy_version)) between 1 and 80),
  check (terms_of_service_version is null or length(btrim(terms_of_service_version)) between 1 and 80),
  check (not enabled or (privacy_policy_version is not null and terms_of_service_version is not null))
);
insert into public.lounge_admission_controls (singleton) values (true);
alter table public.lounge_admission_controls enable row level security;
revoke all on public.lounge_admission_controls from public, anon, authenticated, service_role;

create function public.get_lounge_admission()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  claims jsonb := auth.jwt();
  session_text text := claims ->> 'session_id';
  expiry_text text := claims ->> 'exp';
  now_at timestamptz := clock_timestamp();
  control public.lounge_admission_controls%rowtype;
begin
  -- PostgREST verifies the JWT. The row test ALSO rejects a still-unexpired
  -- access token whose Supabase session was removed by logout/revocation.
  -- No caller-supplied target ID or metadata eligibility flag is accepted.
  if actor is null or claims ->> 'role' is distinct from 'authenticated'
    or session_text is null
    or session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or expiry_text is null or expiry_text !~ '^[0-9]{1,12}$' then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
  end if;
  if expiry_text::numeric <= extract(epoch from now_at)
    or not exists (
      select 1 from auth.sessions s join auth.users u on u.id = s.user_id
      where s.id = session_text::uuid and s.user_id = actor
        and (s.not_after is null or s.not_after > now_at)
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and coalesce(u.is_anonymous, false) = false
        and (u.banned_until is null or u.banned_until <= now_at)
    ) then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
  end if;

  select * into control from public.lounge_admission_controls where singleton;
  if control.enabled is distinct from true
    or public.service_feature_enabled('ACCOUNT') is distinct from true then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOUNGE_DISABLED');
  end if;
  -- Same first-wave enrollment, KST >=14 and deletion conditions as 0028.
  -- Do not call its older nested helper: 0012 uses the database timezone,
  -- conflicting with the KST birthday boundary. No global helper is changed.
  if not exists (select 1 from public.beta_enrollments e where e.user_id = actor)
    or exists (select 1 from public.account_deletion_requests d where d.user_id = actor)
    or not exists (
      select 1 from public.user_private_profiles p
      where p.user_id = actor and p.deletion_requested_at is null
        and p.birth_date <= (now_at at time zone 'Asia/Seoul')::date - interval '14 years'
        and p.privacy_policy_version = control.privacy_policy_version
        and p.terms_of_service_version = control.terms_of_service_version
        and p.legal_consented_at is not null and p.legal_consented_at <= now_at
    ) then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','PARTICIPATION_RESTRICTED');
  end if;
  return jsonb_build_object('version',1,'subject',actor,'eligible',true,'code',null);
end;
$$;
revoke all on function public.get_lounge_admission() from public, anon, authenticated, service_role;
grant execute on function public.get_lounge_admission() to authenticated;

comment on function public.get_lounge_admission() is
  'Current caller lounge eligibility only; no user/profile metadata. Sessions checked at query time, not a distributed transaction or a reservation.';
