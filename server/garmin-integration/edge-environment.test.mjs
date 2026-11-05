import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {prepareEdgeEnvironment,bootstrapGarminEdge} from './edge-environment.mjs';
import {runtimeFromEnvironment} from './service.mjs';
import {loadOracleMigrationChain} from '../../supabase/tests/local-postgres/oracle-auth-fixture.mjs';

// Entirely synthetic local keys, identities, endpoints and disposable SQL state.
const rootKey=Buffer.alloc(32,101).toString('base64');
const nextKey=Buffer.alloc(32,102).toString('base64');
const syntheticJwt=claims=>{const data=[{alg:'HS256',typ:'JWT'},claims].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');return `${data}.${createHmac('sha256','SYNTHETIC_NOT_A_PROJECT_KEY').update(data).digest('base64url')}`;};
const publicAnonJwt=syntheticJwt({role:'anon',ref:'texspxlpjungyarkvtkc'});
const source=(activeKeyId='journal-old',keys={'journal-old':rootKey})=>({
  SUPABASE_URL:'https://synthetic-project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_KEY',SUPABASE_ANON_KEY:publicAnonJwt,
  TRAINORACLE_JOURNAL_KEYRING_JSON:JSON.stringify({activeKeyId,keys}),
  TRAINORACLE_GARMIN_REVIEWED_PROFILE_JSON:JSON.stringify({evidenceReference:'SYNTHETIC_ONLY'}),
  TRAINORACLE_GARMIN_ENABLED:'true',TRAINORACLE_GARMIN_PUSH_ENABLED:'true',
});
const configHash='a'.repeat(64);
const fakeMetadata=rootKeyId=>async()=>Response.json({rootKeyId});
const material=env=>[
  JSON.parse(env.TRAINORACLE_GARMIN_ATTESTATION_JSON).key,
  JSON.parse(env.TRAINORACLE_GARMIN_RELAY_ATTESTATION_JSON).key,
  Object.values(JSON.parse(env.TRAINORACLE_GARMIN_VAULT_JSON).keys)[0],
  env.TRAINORACLE_GARMIN_IDENTITY_KEY,env.TRAINORACLE_GARMIN_CRON_KEY,
];

test('Edge HKDF separates purposes and only derived registration keys leave the process',async()=>{
  const requests=[];
  const fetchImpl=async(url,options)=>{requests.push({url:String(url),options});return Response.json(requests.length===1?{rootKeyId:null}:{registered:true});};
  const original={...source(),TRAINORACLE_GARMIN_RELAY_HTTP_KEY:'SYNTHETIC_UNUSED_LEGACY_KEY'},env=await prepareEdgeEnvironment(original,{fetchImpl});
  assert.equal(new Set(material(env)).size,5);
  assert.equal(env.TRAINORACLE_GARMIN_RELAY_HTTP_KEY,undefined);
  for(const key of material(env)){assert.equal(Buffer.from(key,'base64').length,32);assert.notEqual(key,rootKey);}
  assert.equal(original.TRAINORACLE_GARMIN_IDENTITY_KEY,undefined);
  await bootstrapGarminEdge(env,configHash,{fetchImpl});
  assert.equal(requests.length,2);
  for(const request of requests){
    assert.ok(request.url.startsWith('https://synthetic-project.supabase.co/rest/v1/rpc/garmin_edge_bootstrap'));
    assert.equal(request.options.redirect,'error');
    assert.equal(request.options.body.includes(rootKey),false);
    assert.equal(request.options.body.includes('TRAINORACLE_JOURNAL_KEYRING_JSON'),false);
  }
  const registration=JSON.parse(requests[1].options.body).input;
  assert.equal(registration.validUntil,null);assert.equal(registration.enabled,true);
  assert.equal(registration.gatewayJwt,publicAnonJwt);
});

test('only in-process Edge tasks can configure without a legacy HTTP relay key',async()=>{
  const env=await prepareEdgeEnvironment({...source(),SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',
    TRAINORACLE_JOURNAL_ATTESTATION_JSON:JSON.stringify({keyId:'synthetic-journal',key:nextKey}),
    TRAINORACLE_GARMIN_REVIEWED_PROFILE_JSON:JSON.stringify({accessLevel:'STARTER',evidenceReference:'SYNTHETIC_ONLY',
      clientId:'synthetic-client',clientSecret:'synthetic-client-secret',redirectUri:'https://app.example.test/?garmin_callback=1'}),
  },{fetchImpl:fakeMetadata(null)});
  assert.equal((await runtimeFromEnvironment(env)).configured,false);
  assert.equal((await runtimeFromEnvironment(env,{inProcessTasks:true})).configured,true);
});

test('pinned root survives journal active-key rotation and missing pinned material fails closed',async()=>{
  const initial=await prepareEdgeEnvironment(source(),{fetchImpl:fakeMetadata(null)});
  const rotated=await prepareEdgeEnvironment(source('journal-next',{'journal-old':rootKey,'journal-next':nextKey}),{fetchImpl:fakeMetadata('journal-old')});
  assert.deepEqual(material(rotated),material(initial));
  assert.equal(rotated.TRAINORACLE_GARMIN_ROOT_KEY_ID,'journal-old');
  assert.equal(JSON.parse(rotated.TRAINORACLE_JOURNAL_KEYRING_JSON).activeKeyId,'journal-next');
  await assert.rejects(()=>prepareEdgeEnvironment(source('journal-next',{'journal-next':nextKey}),{fetchImpl:fakeMetadata('journal-old')}));
  await assert.rejects(()=>prepareEdgeEnvironment({...source(),TRAINORACLE_JOURNAL_KEYRING_JSON:'{}'},{fetchImpl:fakeMetadata(null)}));
});

const require=createRequire(new URL('../../supabase/tests/local-postgres/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const db=new PGlite({extensions:{pgcrypto}});
const admin=async(sql,params=[])=>{await db.exec('reset role');return db.query(sql,params);};
const asRole=async role=>{await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role})]);};
const register=async input=>{await asRole('service_role');return (await db.query('select public.garmin_edge_bootstrap($1) result',[input])).rows[0].result;};
let seed;
before(async()=>{
  await loadOracleMigrationChain(db);
  for(const name of ['20261104103908_garmin_integration_runtime.sql','20261104231500_garmin_credential_maintenance.sql','20261105020000_garmin_autosave.sql','20261105033607_garmin_optional_operating_expiry.sql'])
    await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8'));
  // External pg_net is replaced by a local capture only; production SQL is unchanged.
  await db.exec(`create schema net;
    create table net.synthetic_requests(id bigserial primary key,url text,body jsonb,headers jsonb,timeout_milliseconds integer);
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) returns bigint
      language plpgsql as $$declare receipt bigint;begin insert into net.synthetic_requests(url,body,headers,timeout_milliseconds)
      values($1,$2,$3,$4) returning id into receipt;return receipt;end $$;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261105033618_garmin_edge_backend.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261105034859_garmin_edge_platform_auth.sql',import.meta.url),'utf8'));
  const env=await prepareEdgeEnvironment(source(),{fetchImpl:fakeMetadata(null)});
  await bootstrapGarminEdge(env,configHash,{fetchImpl:async(url,options)=>{seed=JSON.parse(options.body).input;return Response.json({registered:true});}});
});
beforeEach(async()=>{
  await admin('delete from garmin_private.tick_nonces');await admin('delete from garmin_private.edge_runtime');
  await admin('delete from garmin_private.edge_gateway');
  await admin('delete from public.garmin_revocation_outbox');
  await admin('delete from public.garmin_connections');await admin('delete from public.garmin_integration_keys');
  await admin('delete from public.garmin_integration_controls');await admin('delete from net.synthetic_requests');
  await admin("update public.service_feature_controls set enabled=false where feature_key='DEVICE_INTEGRATION'");
});
after(async()=>{await db.close();});

test('bootstrap and replay RPCs deny anonymous and authenticated roles even with forged service claims',async()=>{
  for(const role of ['anon','authenticated']){
    await asRole(role);await db.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
    await assert.rejects(()=>db.query('select public.garmin_edge_bootstrap($1)',[seed]),e=>e.code==='42501');
    await assert.rejects(()=>db.query('select public.garmin_edge_claim_tick($1,$2)',['1'.repeat(64),Math.floor(Date.now()/1000)]),e=>e.code==='42501');
    await assert.rejects(()=>db.query('select * from garmin_private.edge_runtime'),e=>e.code==='42501');
  }
});

test('bootstrap is idempotent, returns no key, and preserves explicit stop and revoked keys',async()=>{
  const first=await register(seed);assert.deepEqual(first,{registered:true,rootKeyId:'journal-old'});
  await register(seed);assert.equal((await admin('select count(*) n from public.garmin_integration_keys')).rows[0].n,2);
  await admin('update public.garmin_integration_controls set approved=false');
  await admin('update public.garmin_integration_keys set enabled=false');
  await register(seed);
  assert.equal((await admin('select approved from public.garmin_integration_controls')).rows[0].approved,false);
  assert.equal((await admin('select count(*) n from public.garmin_integration_keys where enabled')).rows[0].n,0);
});

test('preparatory bootstrap can finish setup later and missing register action is rejected',async()=>{
  const missingAction={...seed};delete missingAction.action;
  await assert.rejects(()=>register(missingAction),/EDGE_SETUP_INVALID/);
  await register({...seed,configHash:null,evidenceReference:null,enabled:false});
  assert.equal((await admin('select count(*) n from public.garmin_integration_controls')).rows[0].n,0);
  await register(seed);
  assert.equal((await admin('select approved from public.garmin_integration_controls')).rows[0].approved,true);
});

test('bootstrap rejects a changed root, key bytes and configuration without altering saved material',async()=>{
  await register(seed);
  for(const patch of [{rootKeyId:'journal-next'},{runtimeKey:nextKey},{cronKey:nextKey},{configHash:'b'.repeat(64)}])
    await assert.rejects(()=>register({...seed,...patch}),/EDGE_(KEY_CHANGE_REQUIRES_MIGRATION|PROFILE_CHANGE_REQUIRES_REVIEW)/);
  assert.equal((await admin('select root_key_id from garmin_private.edge_runtime')).rows[0].root_key_id,'journal-old');
  assert.equal((await admin('select config_hash from public.garmin_integration_controls')).rows[0].config_hash,configHash);
});

test('bootstrap accepts only this project public anon gateway JWT and keeps private credentials out',async()=>{
  for(const gatewayJwt of [undefined,'not-a-jwt',syntheticJwt({role:'service_role',ref:'texspxlpjungyarkvtkc'}),syntheticJwt({role:'anon',ref:'other-project'})]){
    await assert.rejects(()=>register({...seed,gatewayJwt}),/EDGE_GATEWAY_INVALID/);
    assert.equal((await admin('select count(*) n from public.garmin_integration_keys')).rows[0].n,0);
    assert.equal((await admin('select count(*) n from garmin_private.edge_gateway')).rows[0].n,0);
  }
  await register(seed);
  assert.equal((await admin('select anonymous_jwt from garmin_private.edge_gateway')).rows[0].anonymous_jwt,publicAnonJwt);
  await asRole('authenticated');
  await assert.rejects(()=>db.query('select * from garmin_private.edge_gateway'),e=>e.code==='42501');
});

test('first bootstrap refuses existing Garmin credentials or keys instead of orphaning them',async()=>{
  const owner='11111111-1111-4111-8111-111111111111';
  await admin('insert into auth.users(id) values($1) on conflict do nothing',[owner]);
  await admin("insert into public.garmin_connections(user_id,connection_id,epoch,state,credential,consent_revision,config_hash) values($1,$2,$3,'ACTIVE',$4,1,$5)",
    [owner,'22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',{syntheticCiphertext:'PRESERVE'},configHash]);
  await assert.rejects(()=>register(seed),/EDGE_EXISTING_DATA_REQUIRES_MIGRATION/);
  assert.deepEqual((await admin('select credential from public.garmin_connections')).rows[0].credential,{syntheticCiphertext:'PRESERVE'});
  assert.equal((await admin('select count(*) n from garmin_private.edge_runtime')).rows[0].n,0);
  await admin('delete from public.garmin_connections');
  await admin("insert into public.garmin_integration_keys values('legacy',$1,'RUNTIME',false)",[Buffer.alloc(32,103)]);
  await assert.rejects(()=>register(seed),/EDGE_EXISTING_DATA_REQUIRES_MIGRATION/);
  assert.equal((await admin('select count(*) n from public.garmin_integration_keys')).rows[0].n,1);
});

test('cron replay claim accepts once, rejects stale and malformed stamps, and survives a new caller',async()=>{
  await register(seed);await asRole('service_role');
  const stamp=Math.floor(Date.now()/1000),nonce='c'.repeat(64);
  const claim=async(hash,time)=>(await db.query('select public.garmin_edge_claim_tick($1,$2) result',[hash,time])).rows[0].result.accepted;
  assert.equal(await claim(nonce,stamp),true);
  await asRole('service_role');assert.equal(await claim(nonce,stamp),false);
  assert.equal(await claim('d'.repeat(64),stamp-61),false);
  assert.equal(await claim('bad',stamp),false);
});

test('scheduled tick is gated and signs HTTP requests without a project service key',async()=>{
  await register(seed);
  assert.equal((await admin('select garmin_private.schedule_tick() result')).rows[0].result,null);
  await admin("update public.service_feature_controls set enabled=true where feature_key='DEVICE_INTEGRATION'");
  assert.equal(typeof (await admin('select garmin_private.schedule_tick() result')).rows[0].result,'number');
  const row=(await admin('select * from net.synthetic_requests')).rows[0],h=row.headers;
  assert.equal(row.url,'https://texspxlpjungyarkvtkc.supabase.co/functions/v1/garmin-integration/internal/garmin/tick');
  assert.equal(JSON.stringify(h).includes('SYNTHETIC_SERVICE_KEY'),false);
  assert.equal(h.Authorization,`Bearer ${publicAnonJwt}`);
  const signed=['TRAINORACLE_GARMIN_CRON_V1',seed.cronKeyId,'POST','/internal/garmin/tick',h['x-trainoracle-cron-timestamp'],h['x-trainoracle-cron-nonce'],'{}'].join('\n');
  assert.equal(h['x-trainoracle-cron-signature'],createHmac('sha256',Buffer.from(seed.cronKey,'base64')).update(signed).digest('hex'));
  await admin('update public.garmin_integration_controls set approved=false');
  assert.equal((await admin('select garmin_private.schedule_tick() result')).rows[0].result,null);
  await admin("update public.service_feature_controls set enabled=false where feature_key='DEVICE_INTEGRATION'");
  const owner='11111111-1111-4111-8111-111111111111';
  await admin('insert into auth.users(id) values($1) on conflict do nothing',[owner]);
  await admin('insert into public.garmin_revocation_outbox(id,user_id,connection_id,epoch,credential,config_hash) values($1,$2,$3,$4,$5,$6)',
    ['44444444-4444-4444-8444-444444444444',owner,'22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',{syntheticCiphertext:'REVOKE'},configHash]);
  assert.equal(typeof (await admin('select garmin_private.schedule_tick() result')).rows[0].result,'number');
  await admin('update public.garmin_revocation_outbox set completed_at=clock_timestamp()');
  assert.equal((await admin('select garmin_private.schedule_tick() result')).rows[0].result,null);
});
