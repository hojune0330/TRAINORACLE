-- A credential linked to the account is not the method used by this session.
-- Keep all session/AMR/channel restrictions; only a pure verified OAuth origin
-- stops inheriting the passwordless signup ambiguity of another credential.
begin;
create function public.current_jwt_auth_method_status()
returns text language plpgsql stable security definer set search_path=pg_catalog as $$
declare
 methods jsonb:=auth.jwt()->'amr';method_entry jsonb;
 has_supported_origin boolean:=false;uses_oauth boolean:=false;uses_passwordless boolean:=false;
begin
 if public.current_jwt_session_active()is distinct from true then return 'AUTH_SESSION_INACTIVE';end if;
 if jsonb_typeof(methods)is distinct from 'array'or jsonb_array_length(methods)=0 then return 'AUTH_METHOD_UNSUPPORTED';end if;
 for method_entry in select value from jsonb_array_elements(methods)loop
  if jsonb_typeof(method_entry)is distinct from 'object'
   or jsonb_typeof(method_entry->'method')is distinct from 'string'
   or jsonb_typeof(method_entry->'timestamp')is distinct from 'number'then return 'AUTH_METHOD_UNSUPPORTED';end if;
  if method_entry->>'method'not in('oauth','otp','magiclink','email/signup','token_refresh')then return 'AUTH_METHOD_UNSUPPORTED';end if;
  if method_entry->>'method'in('oauth','otp','magiclink','email/signup')then has_supported_origin:=true;end if;
  if method_entry->>'method'='oauth'then uses_oauth:=true;end if;
  if method_entry->>'method'in('otp','magiclink','email/signup')then uses_passwordless:=true;end if;
 end loop;
 if not has_supported_origin then return 'AUTH_METHOD_UNSUPPORTED';end if;
 -- email/signup can also confirm a password signup. Preserve the existing
 -- conservative passwordless rule, including password added after signup.
 -- password/recovery/invite/etc. have already failed the AMR allowlist above.
 if uses_passwordless and exists(select 1 from auth.users candidate
  where candidate.id=auth.uid()and nullif(candidate.encrypted_password,'')is not null)then return 'AUTH_METHOD_UNSUPPORTED';end if;
 if(uses_oauth and public.service_feature_enabled('AUTH_OAUTH')is distinct from true)
  or(uses_passwordless and public.service_feature_enabled('AUTH_PASSWORDLESS')is distinct from true)then return 'AUTH_CHANNEL_DISABLED';end if;
 return 'ALLOWED';
exception when others then return 'AUTH_METHOD_UNSUPPORTED';
end $$;
revoke all on function public.current_jwt_auth_method_status()from public,anon,authenticated,service_role;
create or replace function public.current_jwt_auth_method_allowed()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select public.current_jwt_auth_method_status()='ALLOWED';
$$;
revoke all on function public.current_jwt_auth_method_allowed()from public,anon,authenticated,service_role;

-- Update only the known auth-failure branch. Existing identity/session binding,
-- age, legal versions, enrollment, deletion, grants and all other branches are
-- retained exactly from the installed definitions (including later legal SQL).
do $$declare signature text;definition text;marker constant text:=$old$if public.current_jwt_auth_method_allowed() is distinct from true then
    return 'AUTH_METHOD_UNSUPPORTED';
  end if;$old$;
begin
 foreach signature in array array[
  'public.claim_beta_seat(date)',
  'public.claim_beta_seat(date,text,text)',
  'public.claim_beta_seat(uuid,date,text,text)',
  'public.claim_beta_seat(uuid,uuid,date,text,text)',
  'public.get_current_account_admission_status(uuid)'
 ]loop
  definition:=replace(pg_get_functiondef(signature::regprocedure),chr(13)||chr(10),chr(10));
  if(length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then
   raise exception 'AUTH_METHOD_HOTFIX_CONTRACT_CHANGED: %',signature;
  end if;
  execute replace(definition,marker,$new$if public.current_jwt_auth_method_allowed() is distinct from true then
    return public.current_jwt_auth_method_status();
  end if;$new$);
 end loop;
end $$;
comment on function public.current_jwt_auth_method_status()is
 'Private session AMR decision. Linked credentials/providers never substitute for current session method. Pure OAuth permits a linked password credential; passwordless signup ambiguity remains denied.';
commit;
