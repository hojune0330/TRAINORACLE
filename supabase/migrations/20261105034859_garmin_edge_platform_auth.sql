begin;
-- The hosted Edge gateway keeps JWT verification enabled. This is the same
-- public anon JWT shipped to browsers, not an operator/service-role credential.
-- Only the signed Garmin envelope / narrow Cron HMAC grants provider authority.
create table garmin_private.edge_gateway (
  singleton boolean primary key default true check(singleton), anonymous_jwt text not null
);
alter table garmin_private.edge_gateway enable row level security;
revoke all on garmin_private.edge_gateway from public,anon,authenticated,service_role;

do $$
declare definition text; before_text text; after_text text;
begin
  definition=pg_get_functiondef('public.garmin_edge_bootstrap(jsonb)'::regprocedure);
  before_text='return jsonb_build_object(''registered'',true,''rootKeyId'',input->>''rootKeyId'');';
  after_text=$replacement$
  declare gateway_token text; claims jsonb; part text;
  begin
    gateway_token=input->>'gatewayJwt';
    if gateway_token is null or length(gateway_token)>4096 or gateway_token !~ '^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then raise exception 'EDGE_GATEWAY_INVALID'; end if;
    part=translate(split_part(gateway_token,'.',2),'-_','+/');
    claims=convert_from(decode(part||repeat('=',(4-length(part)%4)%4),'base64'),'UTF8')::jsonb;
    if claims->>'role' is distinct from 'anon' or claims->>'ref' is distinct from 'texspxlpjungyarkvtkc' then raise exception 'EDGE_GATEWAY_INVALID'; end if;
    insert into garmin_private.edge_gateway(anonymous_jwt) values(gateway_token)
      on conflict(singleton) do update set anonymous_jwt=excluded.anonymous_jwt;
  end;
  return jsonb_build_object('registered',true,'rootKeyId',input->>'rootKeyId');
$replacement$;
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'EDGE_BOOTSTRAP_CONTRACT_CHANGED'; end if;
  execute replace(definition,before_text,after_text);

  definition=pg_get_functiondef('garmin_private.schedule_tick()'::regprocedure);
  before_text='request_id bigint;';after_text='request_id bigint; gateway_token text;';
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'EDGE_TICK_CONTRACT_CHANGED'; end if;
  definition=replace(definition,before_text,after_text);
  before_text='stamp=floor(extract(epoch from clock_timestamp()))::bigint::text;';
  after_text='select anonymous_jwt into gateway_token from garmin_private.edge_gateway where singleton; if not found then return null; end if; '||before_text;
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'EDGE_TICK_CONTRACT_CHANGED'; end if;
  definition=replace(definition,before_text,after_text);
  before_text='jsonb_build_object(''Content-Type'',''application/json'',';
  after_text='jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer ''||gateway_token,';
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'EDGE_TICK_CONTRACT_CHANGED'; end if;
  execute replace(definition,before_text,after_text);
end $$;
commit;
