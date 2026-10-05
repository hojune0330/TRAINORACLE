-- Close the remaining callable authentication surfaces discovered after the
-- account admission review. Public feature switches and supported login
-- methods must apply to direct RPC calls, not only to screen navigation.
begin;

-- This helper is an implementation detail used from owner-run security
-- definer functions and triggers. Direct authenticated execution exposed a
-- boolean oracle for arbitrary child UUIDs, including while SHARING was off.
revoke all on function public.guardian_authority_allowed(uuid, text, date)
  from public, anon, authenticated, service_role;

-- Lounge grants are capabilities that outlive the issuing HTTP request. Only
-- a currently live, password-free, explicitly enabled authentication channel
-- may mint one. issue_lounge_grant() calls this function before every insert.
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
    or expiry_text is null or expiry_text !~ '^[0-9]{1,12}$'
    or public.current_jwt_auth_method_allowed() is distinct from true then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
  end if;
  return public.lounge_session_admission(
    auth.uid(),
    session_text::uuid,
    to_timestamp(expiry_text::double precision)
  );
exception
  when others then
    return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');
end;
$$;

revoke all on function public.get_lounge_admission()
  from public, anon, authenticated, service_role;
grant execute on function public.get_lounge_admission() to authenticated;

comment on function public.get_lounge_admission() is
  'Current caller lounge eligibility. Requires a live server session and a TrainOracle-supported authentication method before a lounge grant can be issued.';

commit;
