begin;
create schema if not exists garmin_private;
revoke all on schema garmin_private from public,anon,authenticated;
create table garmin_private.edge_runtime (
  singleton boolean primary key default true check(singleton),
  root_key_id text not null, cron_key_id text not null,
  cron_secret bytea not null check(octet_length(cron_secret)=32)
);
create table garmin_private.tick_nonces (
  nonce_hash text primary key check(nonce_hash ~ '^[a-f0-9]{64}$'),
  signed_at timestamptz not null
);
alter table garmin_private.edge_runtime enable row level security;
alter table garmin_private.tick_nonces enable row level security;
revoke all on all tables in schema garmin_private from public,anon,authenticated,service_role;

-- Service-only setup. Never returns keys; never changes a pinned root, replaces
-- an existing key, re-enables a revoked key, or resets an existing kill switch.
create function public.garmin_edge_bootstrap(input jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,garmin_private as $$
declare cfg garmin_private.edge_runtime; k public.garmin_integration_keys; p jsonb;
  material bytea; enabled_input boolean; desired_scope text;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(714906281);
  select * into cfg from garmin_private.edge_runtime where singleton;
  if input->>'action'='metadata' then return jsonb_build_object('rootKeyId',cfg.root_key_id); end if;
  if input->>'action' is distinct from 'register' or input->>'rootKeyId' is null
    or not (input->>'rootKeyId' ~ '^[A-Za-z0-9._:-]{1,200}$')
    or jsonb_typeof(input->'enabled') is distinct from 'boolean' then raise exception 'EDGE_SETUP_INVALID'; end if;
  enabled_input=(input->>'enabled')::boolean;
  if cfg.root_key_id is not null and cfg.root_key_id<>input->>'rootKeyId' then raise exception 'EDGE_KEY_CHANGE_REQUIRES_MIGRATION'; end if;
  if cfg.root_key_id is null and (exists(select 1 from public.garmin_connections)
    or exists(select 1 from public.garmin_integration_keys)) then raise exception 'EDGE_EXISTING_DATA_REQUIRES_MIGRATION'; end if;
  for p in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('id',input->>'runtimeKeyId','key',input->>'runtimeKey','scope','RUNTIME'),
    jsonb_build_object('id',input->>'relayKeyId','key',input->>'relayKey','scope','RELAY'))) loop
    if p->>'id' is null or not(p->>'id' ~ '^edge-(runtime|relay)-[a-f0-9]{16}$')
      or p->>'key' is null or not(p->>'key' ~ '^[A-Za-z0-9+/]{43}=$') then raise exception 'EDGE_SETUP_INVALID'; end if;
    material=decode(p->>'key','base64'); desired_scope=p->>'scope';
    select * into k from public.garmin_integration_keys where key_id=p->>'id';
    if found and (k.secret<>material or k.scope<>desired_scope) then raise exception 'EDGE_KEY_CHANGE_REQUIRES_MIGRATION'; end if;
    insert into public.garmin_integration_keys(key_id,secret,scope,enabled)
      values(p->>'id',material,desired_scope,true) on conflict do nothing;
  end loop;
  if input->>'cronKeyId' is null or not(input->>'cronKeyId' ~ '^edge-cron-[a-f0-9]{16}$')
    or input->>'cronKey' is null or not(input->>'cronKey' ~ '^[A-Za-z0-9+/]{43}=$') then raise exception 'EDGE_SETUP_INVALID'; end if;
  material=decode(input->>'cronKey','base64');
  if cfg.root_key_id is not null and (cfg.cron_key_id<>input->>'cronKeyId' or cfg.cron_secret<>material) then raise exception 'EDGE_KEY_CHANGE_REQUIRES_MIGRATION'; end if;
  insert into garmin_private.edge_runtime(root_key_id,cron_key_id,cron_secret)
    values(input->>'rootKeyId',input->>'cronKeyId',material) on conflict do nothing;
  if input->>'configHash' is not null then
    if not(input->>'configHash' ~ '^[a-f0-9]{64}$') or input->>'evidenceReference' is null
      or not(input->>'evidenceReference' ~ '^[A-Za-z0-9._:-]{1,200}$') then raise exception 'EDGE_PROFILE_INVALID'; end if;
    if exists(select 1 from public.garmin_integration_controls where config_hash<>input->>'configHash') then raise exception 'EDGE_PROFILE_CHANGE_REQUIRES_REVIEW'; end if;
    insert into public.garmin_integration_controls(singleton,approved,config_hash,evidence_reference,valid_until)
      values(true,enabled_input,input->>'configHash',input->>'evidenceReference',(input->>'validUntil')::timestamptz)
      on conflict do nothing;
  end if;
  return jsonb_build_object('registered',true,'rootKeyId',input->>'rootKeyId');
end $$;
revoke all on function public.garmin_edge_bootstrap(jsonb) from public,anon,authenticated;
grant execute on function public.garmin_edge_bootstrap(jsonb) to service_role;

-- Replay claims survive Edge restarts and multiple isolates. Only the verified
-- Edge worker can call this RPC; browser and anonymous roles have no grant.
create function public.garmin_edge_claim_tick(nonce_hash text,signed_at bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,garmin_private as $$
declare inserted integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege; end if;
  if nonce_hash is null or not(nonce_hash ~ '^[a-f0-9]{64}$') or signed_at is null
    or abs(extract(epoch from clock_timestamp())-signed_at)>60 then return '{"accepted":false}'::jsonb; end if;
  delete from garmin_private.tick_nonces where tick_nonces.signed_at<clock_timestamp()-interval '2 minutes';
  insert into garmin_private.tick_nonces values(nonce_hash,to_timestamp(signed_at)) on conflict do nothing;
  get diagnostics inserted=row_count;
  return jsonb_build_object('accepted',inserted=1);
end $$;
revoke all on function public.garmin_edge_claim_tick(text,bigint) from public,anon,authenticated;
grant execute on function public.garmin_edge_claim_tick(text,bigint) to service_role;

-- pg_cron runs this with the DB owner, sending only a dedicated short-lived
-- signature. A project service key is never copied to the HTTP job queue.
create function garmin_private.schedule_tick() returns bigint
language plpgsql security definer set search_path=pg_catalog,garmin_private,public as $$
declare cfg garmin_private.edge_runtime; stamp text; nonce text; proof text; request_id bigint;
begin
  select * into cfg from garmin_private.edge_runtime where singleton;
  if not found then return null; end if;
  if not exists(select 1 from public.garmin_revocation_outbox where completed_at is null)
    and (not public.service_feature_enabled('DEVICE_INTEGRATION')
      or not exists(select 1 from public.garmin_integration_controls where approved
        and (valid_until is null or valid_until>clock_timestamp()))) then return null; end if;
  stamp=floor(extract(epoch from clock_timestamp()))::bigint::text;
  nonce=encode(extensions.gen_random_bytes(16),'hex');
  proof=encode(extensions.hmac(convert_to('TRAINORACLE_GARMIN_CRON_V1'||chr(10)||cfg.cron_key_id||chr(10)||
    'POST'||chr(10)||'/internal/garmin/tick'||chr(10)||stamp||chr(10)||nonce||chr(10)||'{}','UTF8'),cfg.cron_secret,'sha256'),'hex');
  select net.http_post(
    url:='https://texspxlpjungyarkvtkc.supabase.co/functions/v1/garmin-integration/internal/garmin/tick',
    body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json',
      'x-trainoracle-cron-key-id',cfg.cron_key_id,'x-trainoracle-cron-timestamp',stamp,
      'x-trainoracle-cron-nonce',nonce,'x-trainoracle-cron-signature',proof),timeout_milliseconds:=55000) into request_id;
  return request_id;
end $$;
revoke all on function garmin_private.schedule_tick() from public,anon,authenticated,service_role;
commit;
