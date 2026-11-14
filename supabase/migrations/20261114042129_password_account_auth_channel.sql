-- Owner adoption 2026-11-14: email/password signup and login are supported.
-- Preparation only: the independent AUTH_PASSWORD server gate starts CLOSED.
begin;
-- This migration updates installed 0065 consumers; it does not create an
-- absent public feature or inherit default PUBLIC EXECUTE from a new function.
do $$declare signature text;column_name text;begin
 foreach signature in array array[
  'public.current_jwt_auth_method_status()','public.current_jwt_auth_method_allowed()','public.current_jwt_session_active()',
  'public.issue_lounge_grant()','public.inspect_lounge_grant(text)'
 ]loop if to_regprocedure(signature)is null then raise exception 'PASSWORD_AUTH_PREREQUISITE_MISSING: %',signature;end if;end loop;
 foreach column_name in array array['requires_oauth','requires_passwordless']loop
  if not exists(select 1 from pg_attribute where attrelid=to_regclass('public.lounge_session_grants')and attname=column_name and not attisdropped)then raise exception 'PASSWORD_AUTH_PREREQUISITE_MISSING: lounge.%',column_name;end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid=to_regclass('public.lounge_session_grants')and conname='lounge_session_grants_auth_origin')then raise exception 'PASSWORD_AUTH_PREREQUISITE_MISSING: lounge auth constraint';end if;
end $$;
alter table public.service_feature_controls drop constraint service_feature_controls_feature_key_check;
alter table public.service_feature_controls add constraint service_feature_controls_feature_key_check check(feature_key in(
 'ACCOUNT','SYNC','SHARING','PLAN_PROPOSALS','PRODUCT_ANALYTICS','FEEDBACK_BOARD','PLAN_BACKUP','PUBLIC_PROFILE','DEVICE_INTEGRATION','ACCOUNT_JOURNAL_V2','FILE_ANALYSIS_WRITE','AUTH_OAUTH','AUTH_PASSWORDLESS','AUTH_PASSWORD'));
alter table public.service_feature_control_events drop constraint service_feature_control_events_feature_key_check;
alter table public.service_feature_control_events add constraint service_feature_control_events_feature_key_check check(feature_key in(
 'ACCOUNT','SYNC','SHARING','PLAN_PROPOSALS','PRODUCT_ANALYTICS','FEEDBACK_BOARD','PLAN_BACKUP','PUBLIC_PROFILE','DEVICE_INTEGRATION','ACCOUNT_JOURNAL_V2','FILE_ANALYSIS_WRITE','AUTH_OAUTH','AUTH_PASSWORDLESS','AUTH_PASSWORD'));
insert into public.service_feature_controls(feature_key,enabled,change_reason)values('AUTH_PASSWORD',false,'OWNER_ADOPTED_PASSWORD_AUTH_PREPARATION_20261114')on conflict do nothing;

create function public.account_auth_channels_enabled(channels text[])
returns boolean language sql volatile security definer set search_path=pg_catalog as $$
 select channels is not null and cardinality(channels)between 1 and 3 and array_position(channels,null)is null
  and cardinality(channels)=(select count(distinct channel)from unnest(channels)channel)
  and channels<@array['AUTH_OAUTH','AUTH_PASSWORDLESS','AUTH_PASSWORD']::text[]
  and not exists(select 1 from unnest(channels)channel where public.service_feature_enabled(channel)is distinct from true);
$$;
-- For already-issued capabilities the minimal, server-recorded channel markers
-- remain authority. An inspector never substitutes their own JWT or provider.
create function public.account_auth_subject_channels_allowed(target_user uuid,channels text[])
returns boolean language sql volatile security definer set search_path=pg_catalog as $$
 select target_user is not null and public.account_auth_channels_enabled(channels)is true and exists(
  select 1 from auth.users u where u.id=target_user
   and(not('AUTH_PASSWORD'=any(channels))or(u.email_confirmed_at is not null and u.email_confirmed_at<=clock_timestamp()and nullif(u.encrypted_password,'')is not null))
   and(not('AUTH_PASSWORDLESS'=any(channels))or nullif(u.encrypted_password,'')is null));
$$;
create function public.current_jwt_auth_channels()
returns text[] language plpgsql stable security definer set search_path=pg_catalog as $$
declare methods jsonb:=auth.jwt()->'amr';entry jsonb;has_password boolean;email_confirmed boolean;
 oauth_origin boolean:=false;password_origin boolean:=false;passwordless_origin boolean:=false;channels text[]:=array[]::text[];
begin
 if public.current_jwt_session_active()is distinct from true then return null;end if;
 if jsonb_typeof(methods)is distinct from 'array'or jsonb_array_length(methods)=0 then return null;end if;
 select nullif(u.encrypted_password,'')is not null,u.email_confirmed_at is not null and u.email_confirmed_at<=clock_timestamp()
  into has_password,email_confirmed from auth.users u where u.id=auth.uid();
 if not found then return null;end if;
 for entry in select value from jsonb_array_elements(methods)loop
  if jsonb_typeof(entry)is distinct from 'object'or jsonb_typeof(entry->'method')is distinct from 'string'or jsonb_typeof(entry->'timestamp')is distinct from 'number'then return null;end if;
  case entry->>'method'
   when 'oauth'then oauth_origin:=true;
   when 'password'then password_origin:=true;
   when 'email/signup'then if has_password then password_origin:=true;else passwordless_origin:=true;end if;
   when 'otp'then passwordless_origin:=true;
   when 'magiclink'then passwordless_origin:=true;
   when 'token_refresh'then null;
   else return null; -- recovery, invite, anonymous, unknown/mixed cannot enroll
  end case;
 end loop;
 if password_origin and(oauth_origin or passwordless_origin)then return null;end if;
 if password_origin and(has_password is distinct from true or email_confirmed is distinct from true)then return null;end if;
 if passwordless_origin and has_password then return null;end if;
 if oauth_origin then channels:=array_append(channels,'AUTH_OAUTH');end if;
 if password_origin then channels:=array_append(channels,'AUTH_PASSWORD');end if;
 if passwordless_origin then channels:=array_append(channels,'AUTH_PASSWORDLESS');end if;
 if cardinality(channels)=0 then return null;end if;return channels;
exception when others then return null;
end $$;
create or replace function public.current_jwt_auth_method_status()
returns text language plpgsql stable security definer set search_path=pg_catalog as $$
declare channels text[];begin
 if public.current_jwt_session_active()is distinct from true then return 'AUTH_SESSION_INACTIVE';end if;
 channels:=public.current_jwt_auth_channels();
 if channels is null then return 'AUTH_METHOD_UNSUPPORTED';end if;
 if public.account_auth_channels_enabled(channels)is distinct from true then return 'AUTH_CHANNEL_DISABLED';end if;
 if public.account_auth_subject_channels_allowed(auth.uid(),channels)is distinct from true then return 'AUTH_METHOD_UNSUPPORTED';end if;
 return 'ALLOWED';
exception when others then return 'AUTH_METHOD_UNSUPPORTED';
end $$;
revoke all on function public.account_auth_channels_enabled(text[]),public.account_auth_subject_channels_allowed(uuid,text[]),public.current_jwt_auth_channels(),public.current_jwt_auth_method_status()from public,anon,authenticated,service_role;
-- The previous boolean wrapper and text RPCs automatically use this decision.
-- Their existing owner/session, age, legal, deletion and storage gates stay intact.

alter table public.lounge_session_grants add column requires_password boolean not null default false;
alter table public.lounge_session_grants drop constraint lounge_session_grants_auth_origin;
alter table public.lounge_session_grants add constraint lounge_session_grants_auth_origin check(
 (requires_oauth is null and requires_passwordless is null and requires_password=false)
 or(requires_oauth is not null and requires_passwordless is not null and(requires_oauth or requires_passwordless or requires_password)));
create or replace function public.issue_lounge_grant()
returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare admission jsonb;actor uuid:=auth.uid();session_uuid uuid;issued_at timestamptz;expiry timestamptz;credential text;channels text[];
begin
 admission:=public.get_lounge_admission();
 if admission->>'eligible'is distinct from 'true'then raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE'using errcode='42501';end if;
 session_uuid:=(auth.jwt()->>'session_id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('lounge-grant:'||session_uuid::text,0));
 if public.current_jwt_auth_method_allowed()is distinct from true then raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE'using errcode='42501';end if;
 issued_at:=clock_timestamp();expiry:=least(to_timestamp((auth.jwt()->>'exp')::double precision),issued_at+interval '8 hours');
 admission:=public.lounge_session_admission(actor,session_uuid,expiry);
 if admission->>'eligible'is distinct from 'true'then raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE'using errcode='42501';end if;
 channels:=public.current_jwt_auth_channels();
 if public.account_auth_subject_channels_allowed(actor,channels)is distinct from true then raise exception 'LOUNGE_PARTICIPATION_UNAVAILABLE'using errcode='42501';end if;
 delete from public.lounge_session_grants where session_id=session_uuid and expires_at<=issued_at;
 if(select count(*)from public.lounge_session_grants where session_id=session_uuid and requires_oauth is not null and requires_passwordless is not null)>=16
  or exists(select 1 from public.lounge_session_grants where session_id=session_uuid and created_at>issued_at-interval '1 second')then raise exception 'LOUNGE_GRANT_RATE_LIMITED'using errcode='P0001';end if;
 credential:='lg1_'||encode(extensions.gen_random_bytes(32),'hex');
 insert into public.lounge_session_grants(token_hash,user_id,session_id,created_at,expires_at,requires_oauth,requires_passwordless,requires_password)
  values(extensions.digest(credential,'sha256'),actor,session_uuid,issued_at,expiry,'AUTH_OAUTH'=any(channels),'AUTH_PASSWORDLESS'=any(channels),'AUTH_PASSWORD'=any(channels));
 return jsonb_build_object('version',1,'grant',credential,'expiresAt',to_char(expiry at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $$;
create or replace function public.inspect_lounge_grant(grant_token text)
returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare proof public.lounge_session_grants%rowtype;channels text[];begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if grant_token is null or length(grant_token)<>68 or grant_token!~'^lg1_[0-9a-f]{64}$'then return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');end if;
 select * into proof from public.lounge_session_grants where token_hash=extensions.digest(grant_token,'sha256');
 if not found or proof.requires_oauth is null or proof.requires_passwordless is null then return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');end if;
 channels:=array_remove(array[case when proof.requires_oauth then 'AUTH_OAUTH'end,case when proof.requires_passwordless then 'AUTH_PASSWORDLESS'end,case when proof.requires_password then 'AUTH_PASSWORD'end],null);
 if public.account_auth_subject_channels_allowed(proof.user_id,channels)is distinct from true then return jsonb_build_object('version',1,'subject',null,'eligible',false,'code','LOGIN_REQUIRED');end if;
 return public.lounge_session_admission(proof.user_id,proof.session_id,proof.expires_at);
end $$;
comment on column public.lounge_session_grants.requires_password is 'Actual server-verified password origin; false for pre-password-policy grants. No credential/JWT/AMR body stored.';
comment on function public.inspect_lounge_grant(text)is 'Lounge-only capability: current origin channels, credential state and existing session/admission checks; no caller JWT substitution.';

-- Existing execute grants on installed issue/inspect functions are preserved.
comment on function public.current_jwt_auth_method_status()is 'Owner-adopted email/password channel plus independent OAuth/passwordless; active session and confirmed password email required. Recovery/invite/anonymous/unknown AMR do not admit.';
commit;
