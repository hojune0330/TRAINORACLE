-- OPTIONAL COMPANION, NOT A MIGRATION OR PUBLIC FEATURE ACTIVATION.
-- Apply only AFTER the independently approved first installation of 0062 and
-- the core 20261114042129 password channel migration. No production application
-- of this companion is claimed. Existing comparison controls remain unchanged.
-- Source scope: 0062 exact attested body and stored subject/channel rechecks.
begin;
do $$declare signature text;begin
 foreach signature in array array[
  'public.account_auth_channels_enabled(text[])','public.account_auth_subject_channels_allowed(uuid,text[])','public.current_jwt_auth_channels()',
  'public.oracle_profile_comparison_attested(text,text,text)','public.oracle_profile_comparison_subject_allowed(uuid,uuid)',
  'public.oracle_profile_comparison_channels_allowed(text[])'
 ]loop if to_regprocedure(signature)is null then raise exception 'PASSWORD_COMPARISON_PREREQUISITE_MISSING: %',signature;end if;end loop;
end $$;
create or replace function public.oracle_profile_comparison_channels_allowed(channels text[])
returns boolean language sql volatile security definer set search_path=pg_catalog as $$select public.account_auth_channels_enabled(channels);$$;
create or replace function public.oracle_profile_comparison_subject_allowed(subject uuid,session_id uuid)
returns boolean language sql volatile security definer set search_path=pg_catalog as $$
 select public.account_storage_subject_allowed(subject)is true and exists(
  select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=subject and s.id=session_id
   and(s.not_after is null or s.not_after>clock_timestamp())and u.email_confirmed_at is not null
   and u.deleted_at is null and coalesce(u.is_anonymous,false)=false and(u.banned_until is null or u.banned_until<=clock_timestamp()));
$$;
create function public.oracle_profile_comparison_authority_allowed(subject uuid,session_id uuid,channels text[])
returns boolean language sql volatile security definer set search_path=pg_catalog as $$
 select public.oracle_profile_comparison_subject_allowed(subject,session_id)is true and public.account_auth_subject_channels_allowed(subject,channels)is true;
$$;
-- Exact source patches preserve bilateral consent, key checks, record CAS,
-- withdrawal and owner locks. Never classify a stored peer by the reader's AMR.
do $$declare definition text;old text;replacement text;pair text[];begin
 definition:=replace(pg_get_functiondef('public.oracle_profile_comparison_attested(text,text,text)'::regprocedure),chr(13)||chr(10),chr(10));
 old:=$old$select array_agg(distinct case method->>'method' when 'oauth' then 'AUTH_OAUTH' else 'AUTH_PASSWORDLESS' end)
    into auth_channels from jsonb_array_elements(claims->'amr') method
    where method->>'method' in('oauth','otp','magiclink','email/signup');$old$;
 if position(old in definition)=0 then raise exception 'PASSWORD_COMPARISON_CHANNEL_CONTRACT_CHANGED';end if;
 definition:=replace(definition,old,'auth_channels := public.current_jwt_auth_channels();');
 foreach pair slice 1 in array array[
  ['public.oracle_profile_comparison_subject_allowed(actor,sid)','public.oracle_profile_comparison_authority_allowed(actor,sid,public.current_jwt_auth_channels())'],
  ['public.oracle_profile_comparison_subject_allowed(invitation.owner_id,invitation.owner_session_id)','public.oracle_profile_comparison_authority_allowed(invitation.owner_id,invitation.owner_session_id,invitation.owner_auth_channels)'],
  ['public.oracle_profile_comparison_subject_allowed(a.owner_id,a.consent_session_id)','public.oracle_profile_comparison_authority_allowed(a.owner_id,a.consent_session_id,a.consent_auth_channels)'],
  ['public.oracle_profile_comparison_subject_allowed(b.owner_id,b.consent_session_id)','public.oracle_profile_comparison_authority_allowed(b.owner_id,b.consent_session_id,b.consent_auth_channels)']
 ]loop
  if(length(definition)-length(replace(definition,pair[1],'')))/length(pair[1])<>2 then raise exception 'PASSWORD_COMPARISON_SUBJECT_CONTRACT_CHANGED';end if;
  definition:=replace(definition,pair[1],pair[2]);
 end loop;execute definition;
end $$;
revoke all on function public.oracle_profile_comparison_authority_allowed(uuid,uuid,text[]),public.oracle_profile_comparison_subject_allowed(uuid,uuid),public.oracle_profile_comparison_channels_allowed(text[])from public,anon,authenticated,service_role;

commit;
