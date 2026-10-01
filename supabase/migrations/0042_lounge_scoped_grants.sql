-- A Supabase access JWT can contain email/profile claims and grants access to
-- unrelated account APIs. Never forward it to the shared lounge. Exchange it
-- INSIDE this project for a random credential accepted only by inspect_lounge_grant.
create table public.lounge_session_grants (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  check (expires_at > created_at and expires_at <= created_at + interval '8 hours')
);
create index lounge_session_grants_session on public.lounge_session_grants(session_id, created_at);
create index lounge_session_grants_expiry on public.lounge_session_grants(expires_at);
alter table public.lounge_session_grants enable row level security;
revoke all on public.lounge_session_grants from public, anon, authenticated, service_role;

-- Private shared predicate: no caller can supply another member/session to it.
create function public.lounge_session_admission(actor uuid, session_uuid uuid, expires timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  now_at timestamptz := clock_timestamp();
  control public.lounge_admission_controls%rowtype;
begin
  if actor is null or session_uuid is null or expires is null or expires <= now_at
    or not exists (
      select 1 from auth.sessions s join auth.users u on u.id = s.user_id
      where s.id = session_uuid and s.user_id = actor
        and (s.not_after is null or s.not_after > now_at)
        and u.email_confirmed_at is not null and u.deleted_at is null
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
revoke all on function public.lounge_session_admission(uuid,uuid,timestamptz) from public, anon, authenticated, service_role;

create or replace function public.get_lounge_admission()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  claims jsonb := auth.jwt();
  session_text text := claims ->> 'session_id';
  expiry_text text := claims ->> 'exp';
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if auth.uid() is null or claims ->> 'role' is distinct from 'authenticated'
    or session_text is null
    or session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or expiry_text is null or expiry_text !~ '^[0-9]{1,12}$' then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
  end if;
  return public.lounge_session_admission(auth.uid(),session_text::uuid,to_timestamp(expiry_text::double precision));
end;
$$;
revoke all on function public.get_lounge_admission() from public, anon, authenticated, service_role;
grant execute on function public.get_lounge_admission() to authenticated;

create function public.issue_lounge_grant()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  admission jsonb;
  actor uuid := auth.uid();
  session_uuid uuid;
  issued_at timestamptz;
  expiry timestamptz;
  credential text;
begin
  admission := public.get_lounge_admission();
  if admission ->> 'eligible' is distinct from 'true' then
    raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE' using errcode = '42501';
  end if;
  session_uuid := (auth.jwt() ->> 'session_id')::uuid;
  -- Bound both simultaneous issuance and abandoned/retried requests. This is
  -- not an activity log; raw credentials are never stored or returned again.
  perform pg_advisory_xact_lock(hashtextextended('lounge-grant:' || session_uuid::text, 0));
  issued_at := clock_timestamp();
  expiry := least(to_timestamp((auth.jwt() ->> 'exp')::double precision), issued_at + interval '8 hours');
  admission := public.lounge_session_admission(actor,session_uuid,expiry);
  if admission ->> 'eligible' is distinct from 'true' then
    raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE' using errcode = '42501';
  end if;
  delete from public.lounge_session_grants where session_id = session_uuid and expires_at <= issued_at;
  if (select count(*) from public.lounge_session_grants where session_id = session_uuid) >= 16
    or exists (select 1 from public.lounge_session_grants where session_id = session_uuid and created_at > issued_at - interval '1 second') then
    raise exception 'LOUNGE_GRANT_RATE_LIMITED' using errcode = 'P0001';
  end if;
  credential := 'lg1_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.lounge_session_grants(token_hash,user_id,session_id,created_at,expires_at)
    values (extensions.digest(credential,'sha256'),actor,session_uuid,issued_at,expiry);
  return jsonb_build_object('version',1,'grant',credential,
    'expiresAt',to_char(expiry at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end;
$$;
revoke all on function public.issue_lounge_grant() from public, anon, authenticated, service_role;
grant execute on function public.issue_lounge_grant() to authenticated;

create function public.inspect_lounge_grant(grant_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  proof public.lounge_session_grants%rowtype;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if grant_token is null or length(grant_token) <> 68 or grant_token !~ '^lg1_[0-9a-f]{64}$' then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
  end if;
  select * into proof from public.lounge_session_grants where token_hash = extensions.digest(grant_token,'sha256');
  if not found then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
  end if;
  return public.lounge_session_admission(proof.user_id,proof.session_id,proof.expires_at);
end;
$$;
revoke all on function public.inspect_lounge_grant(text) from public, anon, authenticated, service_role;
-- The 256-bit grant, not the public project key, is the credential. It confers
-- no access to account tables, diary APIs, or arbitrary subject lookups.
grant execute on function public.inspect_lounge_grant(text) to anon, authenticated;

-- Keep the existing daily owner-operated retention entry point and response
-- contract. No new job or broader service-role table privilege is introduced.
alter function public.purge_expired_beta_data() rename to purge_expired_beta_data_before_lounge;
revoke all on function public.purge_expired_beta_data_before_lounge() from public, anon, authenticated, service_role;
create function public.purge_expired_beta_data()
returns table (analytics_deleted bigint, accounts_deleted bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  return query select * from public.purge_expired_beta_data_before_lounge();
  delete from public.lounge_session_grants where expires_at <= clock_timestamp();
end;
$$;
revoke all on function public.purge_expired_beta_data() from public, anon, authenticated, service_role;
grant execute on function public.purge_expired_beta_data() to service_role;

comment on table public.lounge_session_grants is
  'Private hashed lounge-only capabilities. Expire no later than issuing JWT or 8h; session/account deletion cascades; expired rows join existing daily retention job even when lounge disabled. Verify that job before activation.';
