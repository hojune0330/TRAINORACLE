-- Add narrowly scoped own-account settings. No feature gates are opened.
begin;

create function public.get_account_auth_methods(expected_user_id_input uuid, expected_session_id_input uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if actor is null or actor is distinct from expected_user_id_input
  or auth.jwt()->>'role' is distinct from 'authenticated'
  or expected_session_id_input is null or auth.jwt()->>'session_id' is distinct from expected_session_id_input::text
  or public.current_jwt_auth_method_allowed() is distinct from true
  or public.account_admission_access_allowed(actor) is distinct from true then
  raise exception 'ACCOUNT_SETTINGS_UNAVAILABLE' using errcode='42501';
 end if;
 select jsonb_build_object('providers',coalesce((select jsonb_agg(distinct identity.provider)
   from auth.identities identity where identity.user_id=actor),'[]'::jsonb),
   'hasPassword',nullif(candidate.encrypted_password,'') is not null)
 into result from auth.users candidate where candidate.id=actor;
 return result;
end $$;

create function public.reaccept_account_terms(expected_user_id_input uuid, expected_session_id_input uuid,
 privacy_policy_version_input text, terms_of_service_version_input text)
returns text language plpgsql volatile security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); profile public.user_private_profiles%rowtype; result text;
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if actor is null or auth.jwt()->>'role' is distinct from 'authenticated' then return 'LOGIN_REQUIRED';end if;
 if actor is distinct from expected_user_id_input then return 'IDENTITY_MISMATCH';end if;
 if expected_session_id_input is null or auth.jwt()->>'session_id' is distinct from expected_session_id_input::text then return 'SESSION_MISMATCH';end if;
 if public.current_jwt_auth_method_allowed() is distinct from true then return public.current_jwt_auth_method_status();end if;
 -- Preserve claim_beta_seat's capacity -> profile lock order. An existing
 -- enrollment is required and locked; this operation never allocates a seat.
 perform 1 from public.beta_capacity_controls where capacity_key='PUBLIC_BETA' for update;
 select * into profile from public.user_private_profiles where user_id=actor for update;
 if not found then return 'NEEDS_PROFILE';end if;
 perform 1 from public.beta_enrollments where user_id=actor for key share;
 if not found then return 'BETA_NOT_ENROLLED';end if;
 if profile.privacy_policy_version=privacy_policy_version_input
  and profile.terms_of_service_version=terms_of_service_version_input
  and public.get_current_account_admission_status(actor)='ADMITTED' then return 'ADMITTED_EXISTING';end if;
 -- Delegate current legal versions, age, deletion and feature checks to the
 -- installed policy. No copied date constant and no birth date leaves SQL.
 result:=public.claim_beta_seat(actor,expected_session_id_input,profile.birth_date,
  privacy_policy_version_input,terms_of_service_version_input);
 if result='ADMITTED_NEW' then raise exception 'RECONSENT_MUST_NOT_ENROLL' using errcode='40001';end if;
 return result;
end $$;
revoke all on function public.get_account_auth_methods(uuid,uuid),public.reaccept_account_terms(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_account_auth_methods(uuid,uuid),public.reaccept_account_terms(uuid,uuid,text,text) to authenticated;
comment on function public.get_account_auth_methods(uuid,uuid) is 'Own active admitted session only; provider names and password presence only. Never credentials.';
comment on function public.reaccept_account_terms(uuid,uuid,text,text) is 'Explicit reconsent using stored age fact and installed legal policy; never new enrollment or DOB disclosure.';
commit;
