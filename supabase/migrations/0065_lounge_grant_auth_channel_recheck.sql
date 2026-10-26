-- Recheck the current authentication policy for already-issued lounge-only
-- capabilities. Keep only the two verified origin requirements, never JWT/AMR
-- text or identity metadata. Existing grants remain stored but fail closed
-- until expiry/ordinary retention; no legacy origin is guessed or backfilled.
begin;

alter table public.lounge_session_grants
  add column requires_oauth boolean,
  add column requires_passwordless boolean,
  add constraint lounge_session_grants_auth_origin check (
    (requires_oauth is null and requires_passwordless is null)
    or (requires_oauth is not null and requires_passwordless is not null
      and (requires_oauth or requires_passwordless))
  );

create or replace function public.issue_lounge_grant()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  admission jsonb;
  actor uuid := auth.uid();
  session_uuid uuid;
  issued_at timestamptz;
  expiry timestamptz;
  credential text;
  oauth_required boolean;
  passwordless_required boolean;
begin
  admission := public.get_lounge_admission();
  if admission ->> 'eligible' is distinct from 'true' then
    raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE' using errcode = '42501';
  end if;
  session_uuid := (auth.jwt() ->> 'session_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('lounge-grant:' || session_uuid::text, 0));
  -- The first admission read can precede the issuance-lock wait. Revalidate
  -- the current supported method, password-free identity and auth switches
  -- inside this same issuance critical section before persisting authority.
  if public.current_jwt_auth_method_allowed() is distinct from true then
    raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE' using errcode = '42501';
  end if;
  issued_at := clock_timestamp();
  expiry := least(to_timestamp((auth.jwt() ->> 'exp')::double precision), issued_at + interval '8 hours');
  admission := public.lounge_session_admission(actor,session_uuid,expiry);
  if admission ->> 'eligible' is distinct from 'true' then
    raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE' using errcode = '42501';
  end if;
  select coalesce(bool_or(method ->> 'method' = 'oauth'),false),
    coalesce(bool_or(method ->> 'method' in ('otp','magiclink','email/signup')),false)
    into oauth_required,passwordless_required
    from jsonb_array_elements(auth.jwt() -> 'amr') method;
  if not (oauth_required or passwordless_required) then
    raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE' using errcode = '42501';
  end if;
  delete from public.lounge_session_grants where session_id = session_uuid and expires_at <= issued_at;
  -- Preserve the sixteen-effective-capability ceiling. Marker-less legacy
  -- rows confer no authority and must not prevent safe immediate reissuance.
  -- They remain only as hashed metadata until their existing expiry/retention;
  -- this temporary storage overlap does not authorize extra effective grants.
  if (select count(*) from public.lounge_session_grants where session_id = session_uuid
      and requires_oauth is not null and requires_passwordless is not null) >= 16
    or exists (select 1 from public.lounge_session_grants where session_id = session_uuid and created_at > issued_at - interval '1 second') then
    raise exception 'LOUNGE_GRANT_RATE_LIMITED' using errcode = 'P0001';
  end if;
  credential := 'lg1_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.lounge_session_grants(token_hash,user_id,session_id,created_at,expires_at,
      requires_oauth,requires_passwordless)
    values (extensions.digest(credential,'sha256'),actor,session_uuid,issued_at,expiry,
      oauth_required,passwordless_required);
  return jsonb_build_object('version',1,'grant',credential,
    'expiresAt',to_char(expiry at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end;
$$;

create or replace function public.inspect_lounge_grant(grant_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  proof public.lounge_session_grants%rowtype;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if grant_token is null or length(grant_token) <> 68 or grant_token !~ '^lg1_[0-9a-f]{64}$' then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
  end if;
  select * into proof from public.lounge_session_grants where token_hash = extensions.digest(grant_token,'sha256');
  if not found or proof.requires_oauth is null or proof.requires_passwordless is null
    or not (proof.requires_oauth or proof.requires_passwordless)
    or (proof.requires_oauth and public.service_feature_enabled('AUTH_OAUTH') is distinct from true)
    or (proof.requires_passwordless and public.service_feature_enabled('AUTH_PASSWORDLESS') is distinct from true)
    or not exists (select 1 from auth.users u where u.id = proof.user_id
      and nullif(u.encrypted_password,'') is null) then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
  end if;
  return public.lounge_session_admission(proof.user_id,proof.session_id,proof.expires_at);
end;
$$;

-- Preserve all existing table/RLS, private-helper, role and retention boundaries.
revoke all on function public.issue_lounge_grant() from public,anon,authenticated,service_role;
grant execute on function public.issue_lounge_grant() to authenticated;
revoke all on function public.inspect_lounge_grant(text) from public,anon,authenticated,service_role;
grant execute on function public.inspect_lounge_grant(text) to anon,authenticated;
comment on column public.lounge_session_grants.requires_oauth is
  'Minimal verified OAuth requirement; null legacy capability is not accepted. No JWT/AMR metadata stored.';
comment on column public.lounge_session_grants.requires_passwordless is
  'Minimal verified passwordless requirement; mixed origins require both current server channels.';
comment on function public.inspect_lounge_grant(text) is
  'Lounge-only hashed capability inspection; rechecks verified auth channels, password-free identity and current session/admission on every call, including anonymous inspectors.';
commit;
