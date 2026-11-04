import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {loadOracleMigrationChain,approveSyntheticOracleStorage,admitOracleStorage,setOracleAuth} from '../../supabase/tests/local-postgres/oracle-auth-fixture.mjs';
import {importJournalAttestor,importJournalKeyring} from '../../supabase/functions/_shared/account-journal-handler.mjs';
import {decryptAccountJournalDocument} from '../../supabase/functions/_shared/account-journal-crypto.mjs';
import {createVault,canonical,sha,sign,prepareObservation,prepareDetail} from './primitives.mjs';
import {createReviewedProvider} from './provider.mjs';
import {createSupabaseRepository} from './repository.mjs';
import {createGarminHandler,createNodeServer} from './service.mjs';
import {createGarminStarterProvider,GARMIN_SCOPES,inCidrs,authenticateGarminPush,normalizeGarminActivity,parseGarminPush} from './garmin-starter.mjs';
import {createGarminPushRuntime} from './push.mjs';

// All identities, keys, endpoints and payloads below are synthetic. SQL is the
// unchanged existing complete migration chain + this candidate in disposable PGlite.
const require=createRequire(new URL('../../supabase/tests/local-postgres/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const db=new PGlite({extensions:{pgcrypto}});
const owner=randomUUID(),other=randomUUID(),sid=randomUUID(),otherSid=randomUUID();
const jwt=(sub,session_id)=>`synthetic.${Buffer.from(JSON.stringify({sub,session_id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.local`;
const token=jwt(owner,sid),otherToken=jwt(other,otherSid),serviceToken='SYNTHETIC_SERVICE_ROLE_ONLY';
const identities=new Map([[token,{ownerId:owner,sessionId:sid}],[otherToken,{ownerId:other,sessionId:otherSid}]]);
const runtimeKey=Buffer.alloc(32,61),relayKey=Buffer.alloc(32,62),identityKey=Buffer.alloc(32,63),relayHttpKey=Buffer.alloc(32,64),journalKey=Buffer.alloc(32,65);
const origin='https://app.example.test';let dbServer,providerServer,apiServer,apiUrl,providerUrl,repository,provider,vault,journalKeyring,journalAttest,profile;
let providerCalls=[],lastChallenge='',subject='synthetic-garmin-subject',mode='normal',providerHook=null,dropConfirmResponse=false,dbQueue=Promise.resolve(),garminWireMode=false;
const admin=async(sql,params=[])=>{await db.exec('reset role');return db.query(sql,params);};
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
const close=server=>new Promise(resolve=>server.close(resolve));
async function raw(req){const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks).toString();}
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const observation=(patch={})=>({provider:'GARMIN',sourceId:'activity-1',sourceVersion:'1',sport:'RUNNING',startedAt:'2026-11-04T01:00:00Z',timeZone:'Asia/Seoul',distanceMeters:10000,durationSeconds:3600,durationMeaning:'TIMER',laps:[{distanceMeters:1000,durationSeconds:360,durationMeaning:'TIMER'}],...patch});
const samples=[{offsetSeconds:0,heartRateBpm:120,powerWatts:null},{offsetSeconds:1,heartRateBpm:121,powerWatts:240}];
const options=()=>({repository,vault,provider,identityKey,relayHttpKey,journalKeyring,journalAttest,allowedOrigins:[origin],enabled:true});

before(async()=>{
  await loadOracleMigrationChain(db);await db.exec(await readFile(new URL('./schema-candidate.sql',import.meta.url),'utf8'));await approveSyntheticOracleStorage(db);
  await admin("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','AUTH_OAUTH','DEVICE_INTEGRATION')");
  for(const [u,s]of [[owner,sid],[other,otherSid]]){await admin('insert into auth.users(id,email_confirmed_at)values($1,clock_timestamp())',[u]);await admin("insert into auth.sessions(id,user_id,not_after)values($1,$2,clock_timestamp()+interval '1 hour')",[s,u]);await admitOracleStorage(db,u,s);}
  await admin("insert into public.garmin_integration_keys values('runtime',$1,'RUNTIME',true),('relay',$2,'RELAY',true)",[runtimeKey,relayKey]);
  await admin("insert into public.account_journal_gateway_keys(key_id,secret,enabled)values('synthetic-journal-gateway',$1,true)",[journalKey]);
  journalKeyring=await importJournalKeyring(JSON.stringify({activeKeyId:'synthetic-journal',keys:{'synthetic-journal':Buffer.alloc(32,66).toString('base64')}}));
  journalAttest=await importJournalAttestor(JSON.stringify({keyId:'synthetic-journal-gateway',key:journalKey.toString('base64')}));
  vault=await createVault({activeKeyId:'synthetic-provider',keys:{'synthetic-provider':Buffer.alloc(32,67).toString('base64')}});
  dbServer=createServer(async(req,res)=>{
    const identity=identities.get(req.headers.authorization?.replace('Bearer ',''));const relay=req.headers.authorization===`Bearer ${serviceToken}`;
    if(!identity&&!relay)return json(res,401,{});
    if(req.url==='/auth/v1/user')return json(res,200,{id:identity?.ownerId});
    if(req.url!=='/rest/v1/rpc/garmin_integration_attested')return json(res,404,{});
    let proof;try{proof=JSON.parse(await raw(req));}catch{return json(res,400,{});}
    const work=async()=>{try{
      if(relay){await db.exec('reset role;set role service_role');await db.query("select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'service_role'})]);}
      else await setOracleAuth(db,identity.ownerId,identity.sessionId);
      await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-trainoracle-storage-revision':req.headers['x-trainoracle-storage-revision']??''})]);
      const result=await db.query('select public.garmin_integration_attested($1,$2,$3) value',[proof.request_text,proof.signature,proof.key_id]);
      if(dropConfirmResponse&&JSON.parse(proof.request_text).action==='confirm'){dropConfirmResponse=false;res.destroy();return;}
      json(res,200,result.rows[0].value);
    }catch(error){if(process.env.GARMIN_SYNTHETIC_SQL_DIAGNOSTICS==='1')process.stderr.write(JSON.stringify({code:error.code,message:error.message,where:error.where})+'\n');json(res,403,{error:'denied',code:error.code});}};
    dbQueue=dbQueue.then(work,work);await dbQueue;
  });
  const dbUrl=await listen(dbServer);
  providerServer=createServer(async(req,res)=>{
    const body=req.method==='POST'?new URLSearchParams(await raw(req)):null;providerCalls.push({url:req.url,body:body?Object.fromEntries(body):null,authorization:req.headers.authorization});
    if(providerHook)await providerHook();
    if(mode==='redirect'){res.writeHead(302,{location:'http://127.0.0.1:9/never'});return res.end();}
    if(req.url==='/subject')return json(res,200,garminWireMode?{userId:subject}:{subject});
    if(req.url==='/permissions')return json(res,mode==='permissions_error'?503:200,{permissions:['ACTIVITY_EXPORT']});
    if(req.url==='/revoke'||req.url==='/registration')return json(res,200,{});
    if(req.url==='/token'){
      if(body.get('grant_type')==='authorization_code'&&createHash('sha256').update(body.get('code_verifier')??'').digest('base64url')!==lastChallenge)return json(res,400,{});
      return json(res,200,{access_token:mode==='permissions_error'?'PRIVATE_ROTATED_ACCESS_CANARY':'PRIVATE_ACCESS_TOKEN_CANARY',refresh_token:mode==='permissions_error'?'PRIVATE_ROTATED_REFRESH_CANARY':'PRIVATE_REFRESH_TOKEN_CANARY',refresh_token_expires_in:7775998,token_type:'Bearer',expires_in:3600,scope:garminWireMode?GARMIN_SCOPES.join(' '):mode==='extra_scope'?'activity:read unsafe:scope':'activity:read'});
    }
    json(res,404,{});
  });
  providerUrl=await listen(providerServer);
  profile={protocol:'OAUTH2_AUTHORIZATION_CODE_PKCE',evidenceReference:'SYNTHETIC_LOCAL_ONLY_NOT_GARMIN_APPROVAL',validUntil:'2099-01-01T00:00:00Z',clientId:'synthetic-client',clientSecret:'PRIVATE_CLIENT_SECRET_CANARY',tokenAuth:'client_secret_basic',scopes:['activity:read'],authorizationEndpoint:`${providerUrl}/authorize`,tokenEndpoint:`${providerUrl}/token`,subjectEndpoint:`${providerUrl}/subject`,subjectField:'subject',redirectUri:'https://app.example.test/garmin-callback',revocationEndpoint:`${providerUrl}/revoke`,allowedDetailFields:['heartRateBpm','powerWatts'],revisionSemantics:'MONOTONIC_ACTIVITY_REVISION_ATTESTED_BY_RELAY'};
  profile.permissionsEndpoint=`${providerUrl}/permissions`;
  provider=createReviewedProvider(profile,{allowLocalHttp:true});
  repository=createSupabaseRepository({url:dbUrl,publishableKey:'synthetic-public',attestation:{keyId:'runtime',key:runtimeKey.toString('base64')},relayAttestation:{keyId:'relay',key:relayKey.toString('base64')},serviceRoleKey:serviceToken,allowLocalHttp:true});
  await admin("insert into public.garmin_integration_controls values(true,true,$1,'SYNTHETIC_LOCAL_TEST_ONLY','2099-01-01')",[provider.configHash]);
  apiServer=createNodeServer(createGarminHandler(options()));apiUrl=await listen(apiServer);
},{timeout:120000});
beforeEach(async()=>{
  providerCalls=[];mode='normal';providerHook=null;subject='synthetic-garmin-subject';dropConfirmResponse=false;garminWireMode=false;
  await admin('delete from public.garmin_inbox');await admin('delete from public.garmin_delivery_events');await admin('delete from public.garmin_oauth_attempts');await admin('delete from public.garmin_revocation_outbox');await admin('delete from public.garmin_connections');
  await admin('update public.garmin_integration_controls set approved=true,config_hash=$1',[provider.configHash]);
  await admin('delete from public.garmin_push_jobs');
  await admin('delete from public.account_journal_finalization_events');await admin('delete from public.account_journal_identity');await admin('delete from public.account_journal_history');await admin('delete from public.account_journal_operations');await admin('delete from public.account_journal_documents');
});
after(async()=>{if(apiServer)await close(apiServer);if(providerServer)await close(providerServer);if(dbServer)await close(dbServer);await db.close();});
async function call(input,opts={}){const response=await fetch(`${opts.url??apiUrl}/api/garmin-integration`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${opts.token??token}`,origin:opts.origin??origin,'x-trainoracle-storage-revision':String(opts.revision??1)},body:JSON.stringify(input)});assert.equal(response.headers.get('cache-control'),'no-store');return {status:response.status,data:await response.json()};}
async function connect(opts={}){const start=await call({action:'connect'},opts);assert.equal(start.status,200,JSON.stringify(start));lastChallenge=new URL(start.data.authorizationUrl).searchParams.get('code_challenge');const complete=await call({action:'complete',state:start.data.state,code:'synthetic-code'},opts);assert.equal(complete.status,200,JSON.stringify(complete));const row=(await admin('select * from public.garmin_connections where user_id=$1',[opts.token===otherToken?other:owner])).rows[0];return {...row,start};}
async function relay(input,path='/internal/garmin/events',headers={}){const timestamp=String(Date.now());const response=await fetch(`${apiUrl}${path}`,{method:'POST',headers:{'content-type':'application/json','x-trainoracle-relay-timestamp':timestamp,'x-trainoracle-relay-signature':sign(relayHttpKey,`${timestamp}\n${path}\n${canonical(input)}`),...headers},body:JSON.stringify(input)});return {status:response.status,data:await response.json()};}
function event(c,patch={}){return {eventId:'event-1',connectionId:c.connection_id,epoch:c.epoch,subject,activityId:'activity-1',revision:1,kind:'UPSERT',observation:observation(),detail:samples,...patch};}
async function receive(c,patch={}){const result=await relay(event(c,patch));assert.equal(result.status,200,JSON.stringify(result));return result.data;}
async function confirm(inbox,operationId=randomUUID()){return call({action:'confirm',inboxId:inbox.inboxId,expectedRevision:inbox.revision,operationId});}

test('default off still supports authenticated status and disconnect without provider calls',async()=>{const server=createNodeServer(createGarminHandler({...options(),enabled:false}));const url=await listen(server);try{const status=await call({action:'status'},{url});assert.equal(status.status,200);assert.equal(status.data.capability.reason,'PROVIDER_CONFIGURATION_PENDING');assert.equal((await call({action:'connect'},{url})).status,503);assert.equal((await call({action:'disconnect'},{url})).status,200);assert.equal(providerCalls.length,0);}finally{await close(server);}});
test('real OAuth HTTP PKCE exchange and subject binding store only encrypted credentials, callback retry never exchanges twice',async()=>{const c=await connect();assert.equal(c.state,'ACTIVE');const persisted=JSON.stringify(c);assert.ok(!persisted.includes('PRIVATE_ACCESS_TOKEN'));assert.ok(!persisted.includes('PRIVATE_REFRESH_TOKEN'));assert.equal(c.subject_hash,sign(identityKey,'garmin-subject-v1:synthetic-garmin-subject'));const replay=await call({action:'complete',state:c.start.data.state,code:'different-code'});assert.equal(replay.status,200);assert.equal(providerCalls.filter(c=>c.url==='/token').length,1);const status=await call({action:'status'});assert.equal(status.data.connection.lastSyncAt,null);});
test('real HTTP -> SQL -> AES-GCM inbox/detail -> atomic existing journal commit and readback',async()=>{const c=await connect();const received=await receive(c);const list=await call({action:'inbox'});assert.equal(list.status,200);assert.equal(list.data.items[0].observation.analysisEligible,false);assert.equal(list.data.items[0].observation.dataLineage.sources[0].originProvider,'GARMIN');const detail=await call({action:'detail',inboxId:received.inboxId,expectedRevision:1,partIndex:0});assert.deepEqual(detail.data.samples,samples);const saved=await confirm(received);assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.data.date,'2026-11-04');const row=(await admin('select * from public.account_journal_documents where user_id=$1 and document_id=$2',[owner,saved.data.documentId])).rows[0];assert.equal(row.revision,1);const document=JSON.parse(await decryptAccountJournalDocument(row.encrypted_payload,{ownerId:owner,documentId:row.document_id},journalKeyring.active));assert.equal(document.entry.distanceKm,'10');assert.equal(document.entry.avgPace,'');assert.equal(document.entry.memo,'');assert.deepEqual(document.entry.fieldProvenance.distanceKm.derivedFrom,['import:provider-activity']);assert.equal(document.entry.fileObservation,undefined);assert.equal((await call({action:'read',documentId:saved.data.documentId})).data.item.inboxId,received.inboxId);assert.ok((await call({action:'status'})).data.connection.lastSyncAt);});
test('lost HTTP acknowledgement retries the same operation without duplicate journal or another credential exchange',async()=>{const c=await connect(),received=await receive(c),operationId=randomUUID();dropConfirmResponse=true;assert.equal((await confirm(received,operationId)).status,503);const replay=await confirm(received,operationId);assert.equal(replay.status,200,JSON.stringify(replay));assert.equal(replay.data.kind,'already_confirmed');assert.equal((await admin('select count(*) n from public.account_journal_documents')).rows[0].n,1);assert.equal((await confirm(received,randomUUID())).status,409);});
test('cross-account OAuth callback, inbox confirmation and detail reads cannot cross owner',async()=>{const start=await call({action:'connect'});assert.equal((await call({action:'complete',state:start.data.state,code:'x'},{token:otherToken})).status,409);const c=await connect();const received=await receive(c);subject='other-provider-subject';await connect({token:otherToken});assert.equal((await call({action:'confirm',inboxId:received.inboxId,expectedRevision:1,operationId:randomUUID()},{token:otherToken})).status,409);assert.equal((await call({action:'detail',inboxId:received.inboxId,expectedRevision:1,partIndex:0},{token:otherToken})).status,409);assert.equal((await call({action:'inbox'},{token:otherToken})).data.items.length,0);});
test('provider subject cannot be rebound to a second app owner',async()=>{await connect();const start=await call({action:'connect'},{token:otherToken});lastChallenge=new URL(start.data.authorizationUrl).searchParams.get('code_challenge');const result=await call({action:'complete',state:start.data.state,code:'x'},{token:otherToken});assert.equal(result.status,409);assert.equal(result.data.error,'PROVIDER_ACCOUNT_ALREADY_BOUND');assert.equal((await admin("select count(*) n from public.garmin_connections where state='ACTIVE'")).rows[0].n,1);});
test('delivery ACK is idempotent; event ID reuse with changed payload fails',async()=>{const c=await connect(),input=event(c);const first=await relay(input),second=await relay(input);assert.deepEqual(second,first);assert.equal((await relay({...input,observation:observation({distanceMeters:999})})).data.error,'EVENT_REUSED');assert.equal((await admin('select count(*) n from public.garmin_inbox')).rows[0].n,1);});
test('monotonic revisions supersede pending data; stale and conflicting revisions cannot silently overwrite',async()=>{const c=await connect(),first=await receive(c);const second=await receive(c,{eventId:'event-2',revision:2,observation:observation({sourceVersion:'2',distanceMeters:11000})});assert.equal(second.inboxId,first.inboxId);assert.equal((await confirm(first)).data.error,'SOURCE_CHANGED');assert.equal((await receive(c,{eventId:'old',revision:1})).kind,'ignored');assert.equal((await receive(c,{eventId:'conflict',revision:2,observation:observation({sourceVersion:'2',distanceMeters:12000})})).kind,'conflict');assert.equal((await confirm(second)).data.error,'REVIEW_REQUIRED');assert.equal((await call({action:'inbox'})).data.items[0].observation.distanceMeters,11000);});
test('update after confirmation is review-required and never edits the saved journal',async()=>{const c=await connect(),first=await receive(c),saved=await confirm(first);assert.equal(saved.status,200,JSON.stringify(saved));const next=await receive(c,{eventId:'new',revision:2,observation:observation({sourceVersion:'2',distanceMeters:22000})});assert.equal(next.kind,'review_required');assert.equal((await confirm(next)).status,409);const row=(await admin('select revision from public.account_journal_documents where document_id=$1',[saved.data.documentId])).rows[0];assert.equal(row.revision,1);});
test('provider deletion leaves a tombstone; later upsert cannot resurrect it',async()=>{const c=await connect(),first=await receive(c);const deleted=await receive(c,{eventId:'deleted',revision:2,kind:'DELETE',observation:null,detail:null});assert.equal(deleted.kind,'deleted');assert.equal((await confirm({...first,revision:2})).data.error,'REVIEW_REQUIRED');assert.equal((await receive(c,{eventId:'late',revision:3})).kind,'ignored');assert.equal((await call({action:'inbox'})).data.items[0].observation,null);assert.equal((await admin('select count(*) n from public.garmin_detail_parts')).rows[0].n,0);});
test('local disconnect invalidates epoch before remote retry and works with operations stopped',async()=>{const c=await connect();await receive(c);await admin('update public.garmin_integration_controls set approved=false');mode='redirect';const disconnected=await call({action:'disconnect'});assert.equal(disconnected.status,200);assert.equal(disconnected.data.connection.state,'REVOKED');assert.equal(disconnected.data.remoteRevocationPending,true);mode='normal';await admin('update public.garmin_integration_controls set approved=true');assert.equal((await relay(event(c,{eventId:'late'}))).data.error,'CONNECTION_CHANGED');const revoke=await relay({},'/internal/garmin/revocations');assert.equal(revoke.data.completed,1);assert.equal(providerCalls.filter(c=>c.url==='/revoke').length,2);});
test('refresh lease stores rotated encrypted credentials; replayed/ambiguous lease requires reconnect',async()=>{await connect();assert.equal((await call({action:'refresh'})).status,200);const row=(await admin('select credential_revision from public.garmin_connections where user_id=$1',[owner])).rows[0];assert.equal(row.credential_revision,2);await admin("update public.garmin_connections set refresh_nonce=$1,refresh_until=clock_timestamp()-interval '1 second' where user_id=$2",[randomUUID(),owner]);const result=await call({action:'refresh'});assert.equal(result.data.error,'OAUTH_RESTART_REQUIRED');});
test('withdrawal during OAuth exchange rejects activation; changed storage revision never adopted automatically',async()=>{const start=await call({action:'connect'});lastChallenge=new URL(start.data.authorizationUrl).searchParams.get('code_challenge');let called=false;providerHook=async()=>{if(called)return;called=true;await admin('update public.account_storage_consents set revision=revision+1 where user_id=$1',[owner]);};const result=await call({action:'complete',state:start.data.state,code:'x'});assert.equal(result.status,409);assert.equal(result.data.error,'CONSENT_CHANGED');await admin('update public.account_storage_consents set revision=1 where user_id=$1',[owner]);});
test('rejected origin, unsigned relay, stale epoch and scope expansion make no successful import',async()=>{assert.equal((await call({action:'status'},{origin:'https://evil.example'})).status,403);const c=await connect();assert.equal((await relay(event(c),'/internal/garmin/events',{'x-trainoracle-relay-signature':'0'.repeat(64)})).status,403);assert.equal((await relay(event(c,{epoch:randomUUID()}))).data.error,'CONNECTION_CHANGED');assert.equal((await relay(event(c,{subject:'wrong-subject'}))).data.error,'CONNECTION_CHANGED');assert.equal((await admin('select count(*) n from public.garmin_inbox')).rows[0].n,0);});
test('provider redirects and unapproved scope expansion fail closed without activation',async()=>{for(const m of ['redirect','extra_scope']){const start=await call({action:'connect'});lastChallenge=new URL(start.data.authorizationUrl).searchParams.get('code_challenge');mode=m;const completed=await call({action:'complete',state:start.data.state,code:'x'});assert.equal(completed.status,502);assert.notEqual((await call({action:'status'})).data.connection.state,'ACTIVE');mode='normal';}});
test('AES AAD binds owner, epoch, purpose, revision and parts; normalized observations reject extra/raw fields',async()=>{const ctx={ownerId:owner,epoch:'a',purpose:'test'},sealed=await vault.seal({secret:'CANARY'},ctx);assert.deepEqual(await vault.open(sealed,ctx),{secret:'CANARY'});for(const patch of [{ownerId:other},{epoch:'b'},{purpose:'different'}])await assert.rejects(()=>vault.open(sealed,{...ctx,...patch}));assert.throws(()=>prepareObservation({...observation(),memo:'private'}));assert.throws(()=>prepareDetail([{offsetSeconds:0,latitude:37}],['heartRateBpm']));assert.throws(()=>prepareDetail([{offsetSeconds:1},{offsetSeconds:0}],[]));});
test('table access and forged RPC bypass denied to authenticated users; session revocation blocks status',async()=>{await setOracleAuth(db,owner,sid);await assert.rejects(()=>db.query('select * from public.garmin_connections'));await assert.rejects(()=>db.query('select public.garmin_integration_attested($1,$2,$3)',['{}','0'.repeat(64),'runtime']));await admin("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[sid]);assert.equal((await call({action:'status'})).status,403);await admin("update auth.sessions set not_after=clock_timestamp()+interval '1 hour' where id=$1",[sid]);});
test('invalid dates, unknown offsets, raw fields and undeclared detail sensors are rejected without normalization guesses',()=>{
  for(const startedAt of ['2026-02-30T01:00:00Z','2026-11-04T24:00:00Z','2026-11-04T01:00:00-00:00','2026-11-04T01:00:00','2026-13-04T01:00:00Z'])assert.throws(()=>prepareObservation(observation({startedAt})));
  assert.throws(()=>prepareObservation(observation({timeZone:undefined})));
  assert.equal(prepareObservation(observation({startedAt:'2024-02-29T01:00:00+09:00'})).startedAt,'2024-02-29T01:00:00+09:00');
});
test('profile expiry during a long-running process closes status and ingestion; fixed callback query is preserved',async()=>{
  let time=Date.now();const expiring=createReviewedProvider({...profile,validUntil:new Date(time+1000).toISOString(),redirectUri:'https://app.example.test/?garmin_callback=1'},{allowLocalHttp:true,now:()=>time});
  assert.equal(new URL(expiring.authorizationUrl('state','challenge')).searchParams.get('redirect_uri'),'https://app.example.test/?garmin_callback=1');
  const server=createNodeServer(createGarminHandler({...options(),provider:expiring}));const url=await listen(server);
  try{time+=2000;const status=await call({action:'status'},{url});assert.equal(status.data.capability.enabled,false);assert.equal(status.data.capability.reason,'PROVIDER_CONFIGURATION_PENDING');assert.equal((await call({action:'connect'},{url})).status,503);assert.equal((await call({action:'disconnect'},{url})).status,200);}finally{await close(server);}
});
test('sensor payload exceeding the journal body limit uses independently encrypted parts and keeps journal small',async()=>{
  const c=await connect();const detail=Array.from({length:15000},(_,i)=>({offsetSeconds:i,heartRateBpm:120+i%40,powerWatts:240}));assert.ok(Buffer.byteLength(JSON.stringify(detail))>655360);
  const received=await receive(c,{detail});const inbox=(await call({action:'inbox'})).data.items[0];assert.ok(inbox.detailManifest.length>1);
  let restored=[];for(const part of inbox.detailManifest){const response=await call({action:'detail',inboxId:received.inboxId,expectedRevision:1,partIndex:part.partIndex});assert.equal(response.status,200);assert.equal(sha(canonical(response.data.samples)),part.sha256);restored.push(...response.data.samples);}assert.deepEqual(restored,detail);
  const saved=await confirm(received);assert.equal(saved.status,200);const row=(await admin('select encrypted_payload from public.account_journal_documents where document_id=$1',[saved.data.documentId])).rows[0];assert.ok(JSON.stringify(row.encrypted_payload).length<10000);
});
test('disconnect during detail decryption suppresses stale data before HTTP response',async()=>{
  const c=await connect(),received=await receive(c);let triggered=false;
  const racedVault={...vault,async open(payload,ctx){const value=await vault.open(payload,ctx);if(ctx.purpose==='detail'&&!triggered){triggered=true;assert.equal((await call({action:'disconnect'})).status,200);}return value;}};
  const server=createNodeServer(createGarminHandler({...options(),vault:racedVault}));const url=await listen(server);
  try{const result=await call({action:'detail',inboxId:received.inboxId,expectedRevision:1,partIndex:0},{url});assert.equal(result.status,409);assert.deepEqual(result.data,{error:'CONNECTION_CHANGED'});}finally{await close(server);}
});
test('journal tombstone survives disconnect/reconnect/resync and cannot be resurrected by confirmation',async()=>{
  const c=await connect(),received=await receive(c),saved=await confirm(received);assert.equal(saved.status,200);
  const proof=await journalAttest(owner,'delete',{documentId:saved.data.documentId,operationId:randomUUID(),expectedRevision:1});
  await setOracleAuth(db,owner,sid);await db.query("select set_config('request.headers','{\"x-trainoracle-storage-revision\":\"1\"}',false)");
  const deleted=(await db.query('select public.mutate_account_journal_attested($1,$2,$3) value',[proof.request_text,proof.signature,proof.key_id])).rows[0].value;assert.equal(deleted.kind,'deleted');
  await call({action:'disconnect'});const next=await connect();const replay=await receive(next,{eventId:'resync'});const denied=await confirm(replay);assert.equal(denied.status,409);assert.equal(denied.data.error,'OPERATION_CONFLICT');
  const row=(await admin('select deleted_at,revision from public.account_journal_documents where document_id=$1',[saved.data.documentId])).rows[0];assert.ok(row.deleted_at);assert.equal(row.revision,2);
});
test('issued Starter wire profile fixes default OAuth scopes, verifies ACTIVITY_EXPORT, queues push before processing and saves detail',async()=>{
  garminWireMode=true;
  const starter=createGarminStarterProvider({accessLevel:'STARTER',clientId:'synthetic-client',clientSecret:'PRIVATE_CLIENT_SECRET_CANARY',evidenceReference:'SYNTHETIC_LOCAL_ONLY',validUntil:'2099-01-01T00:00:00Z',redirectUri:'https://app.example.test/?garmin_callback=1',allowedDetailFields:['heartRateBpm','powerWatts']},{allowLocalHttp:true,testEndpoints:{authorizationEndpoint:`${providerUrl}/authorize`,tokenEndpoint:`${providerUrl}/token`,subjectEndpoint:`${providerUrl}/subject`,permissionsEndpoint:`${providerUrl}/permissions`,registrationEndpoint:`${providerUrl}/registration`}});
  await admin('update public.garmin_integration_controls set config_hash=$1',[starter.configHash]);
  const push=createGarminPushRuntime({repository,vault,provider:starter,identityKey,enabled:true,allowLocalHttp:true,testDeliveryCidrs:['127.0.0.1/32']});
  const server=createNodeServer(createGarminHandler({...options(),provider:starter,push}));const url=await listen(server);
  const signedProcess=async()=>{const path='/internal/garmin/process',timestamp=String(Date.now());const response=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json','x-trainoracle-relay-timestamp':timestamp,'x-trainoracle-relay-signature':sign(relayHttpKey,`${timestamp}\n${path}\n{}`)},body:'{}'});return {status:response.status,data:await response.json()};};
  const postPush=async body=>{const response=await fetch(url+'/webhooks/garmin',{method:'POST',headers:{'content-type':'application/json','garmin-client-id':'synthetic-client'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
  try{
    const start=await call({action:'connect'},{url});assert.equal(start.status,200);const authorization=new URL(start.data.authorizationUrl);assert.equal(authorization.searchParams.has('scope'),false);lastChallenge=authorization.searchParams.get('code_challenge');assert.equal((await call({action:'complete',state:start.data.state,code:'x'},{url})).status,200);
    assert.ok(providerCalls.some(x=>x.url==='/permissions'));
    const startTime=Date.parse('2026-11-03T23:00:00Z')/1000;
    const wire={activityDetails:[{userId:subject,summaryId:'official-shape-detail',activityId:123456,summary:{startTimeInSeconds:startTime,startTimeOffsetInSeconds:32400,durationInSeconds:3600,distanceInMeters:10000,activityType:'RUNNING',activityName:'PRIVATE_NOTE_MUST_NOT_PERSIST'},samples:[{startTimeInSeconds:startTime,heartRate:125,powerInWatts:250},{startTimeInSeconds:startTime+1,heartRate:126}],laps:[{startTimeInSeconds:startTime}]}]};
    const accepted=await postPush(wire);assert.equal(accepted.status,200,JSON.stringify(accepted));assert.equal((await admin('select count(*) n from public.garmin_inbox')).rows[0].n,0,'ACK only enqueues, never processes activity inline');assert.equal((await admin('select count(*) n from public.garmin_push_jobs')).rows[0].n,1);
    assert.equal((await signedProcess()).data.processed,1);const list=await call({action:'inbox'},{url});assert.equal(list.status,200,JSON.stringify(list));const item=list.data.items[0];assert.equal(item.observation.durationMeaning,'UNKNOWN');assert.equal(item.observation.timeZone,'UTC');assert.equal(item.clock.localDate,'2026-11-04');assert.equal(item.clock.offsetSeconds,32400);
    const detail=await call({action:'detail',inboxId:item.inboxId,expectedRevision:item.revision,partIndex:0},{url});assert.equal(detail.data.samples[0].powerWatts,250);
    const saved=await call({action:'confirm',inboxId:item.inboxId,expectedRevision:item.revision,operationId:randomUUID()},{url});assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.data.date,'2026-11-04');
    assert.equal((await postPush(wire)).status,200);assert.equal((await signedProcess()).data.processed,0,'same durable job is not replayed after ACK');
    const changed=structuredClone(wire);changed.activityDetails[0].summary.distanceInMeters=11000;assert.equal((await postPush(changed)).status,200);assert.equal((await signedProcess()).data.reviewRequired,1);assert.equal((await call({action:'inbox'},{url})).data.items[0].state,'CONFLICT');
    const permissions={userPermissionsChange:[{userId:subject,summaryId:'permission-change',permissions:[],changeTimeInSeconds:Date.now()/1000|0}]};assert.equal((await postPush(permissions)).status,200);assert.equal((await call({action:'status'},{url})).data.connection.state,'ERROR');assert.equal((await call({action:'inbox'},{url})).status,409);
    assert.equal((await postPush({deregistrations:[{userId:subject}]})).status,200);assert.equal((await call({action:'status'},{url})).data.connection.state,'REVOKED');
  }finally{await close(server);}
});
test('Garmin delivery peer allowlist never trusts arbitrary forwarded IP or client ID; unsupported PING/file callbacks stay closed',()=>{
  assert.equal(inCidrs('204.77.162.3'),true);assert.equal(inCidrs('127.0.0.1'),false);
  const request=new Request('https://company.example/webhooks/garmin',{headers:{'x-trainoracle-peer-ip':'204.77.162.3','garmin-client-id':'client'}});
  assert.throws(()=>authenticateGarminPush(request,'127.0.0.1',{clientId:'client'}));
  assert.doesNotThrow(()=>authenticateGarminPush(request,'127.0.0.1',{clientId:'client',trustedProxyAddresses:['127.0.0.1']}));
  assert.throws(()=>authenticateGarminPush(request,'204.77.162.3',{clientId:'wrong'}));
  assert.throws(()=>parseGarminPush({activityFiles:[{callbackURL:'https://evil.example'}]}));
  assert.throws(()=>normalizeGarminActivity({feed:'activities',summaryId:'1',summary:{startTimeInSeconds:1,startTimeOffsetInSeconds:86400}}));
});
test('pending remote registration removal prevents reconnect and runtime proof cannot call relay actions',async()=>{
  await connect();mode='redirect';const stopped=await call({action:'disconnect'});assert.equal(stopped.data.remoteRevocationPending,true);
  const next=await call({action:'connect'});assert.equal(next.status,409);assert.equal(next.data.error,'REVOKE_PENDING');mode='normal';
  const auth=await repository.authenticate(token,1);await assert.rejects(()=>repository.call(auth,{action:'resolveSubject',configHash:provider.configHash,subjectHash:'a'.repeat(64)}),error=>error.code==='ACCESS_DENIED');
});
test('successful token rotation followed by permission failure retains only the new encrypted credentials for disconnect',async()=>{
  const c=await connect();mode='permissions_error';const result=await call({action:'refresh'});assert.equal(result.status,502);
  const row=(await admin('select state,credential from public.garmin_connections where user_id=$1',[owner])).rows[0];assert.equal(row.state,'ERROR');
  const current=await vault.open(row.credential,{ownerId:owner,connectionId:c.connection_id,epoch:c.epoch,purpose:'credentials',record:''});assert.equal(current.refreshToken,'PRIVATE_ROTATED_REFRESH_CANARY');
  mode='normal';const disconnected=await call({action:'disconnect'});assert.equal(disconnected.data.remoteRevocationPending,false);assert.equal(providerCalls.filter(x=>x.url==='/revoke').at(-1).body.token,'PRIVATE_ROTATED_REFRESH_CANARY');
});
test('real purpose-consent withdrawal erases new inbox/parts/credentials and old journal; late events remain denied',async()=>{
  const c=await connect(),received=await receive(c);assert.equal((await confirm(received)).status,200);
  await setOracleAuth(db,owner,sid);const withdrawn=(await db.query('select public.set_account_storage_consent($1,$2,1,$3,false,false) value',[owner,sid,'2026-10-05'])).rows[0].value;assert.equal(withdrawn.healthStorage,false);
  for(const table of ['garmin_inbox','garmin_detail_parts','garmin_oauth_attempts','garmin_delivery_events','garmin_revocation_outbox','garmin_push_jobs','account_journal_documents'])assert.equal((await admin(`select count(*) n from public.${table}`)).rows[0].n,0,table);
  const row=(await admin('select state,credential,epoch from public.garmin_connections where user_id=$1',[owner])).rows[0];assert.equal(row.state,'REVOKED');assert.equal(row.credential,null);assert.notEqual(row.epoch,c.epoch);assert.equal((await relay(event(c,{eventId:'after-withdrawal'}))).status,503);
});
test('existing account deletion request immediately invokes consent erasure for Garmin before auth-user removal',async()=>{
  const c=await connect({token:otherToken}),received=await receive(c);assert.equal((await call({action:'confirm',inboxId:received.inboxId,expectedRevision:1,operationId:randomUUID()},{token:otherToken})).status,200);
  await setOracleAuth(db,other,otherSid);await db.query('select public.request_account_deletion($1)',[other]);
  for(const table of ['garmin_inbox','garmin_detail_parts','garmin_oauth_attempts','garmin_delivery_events','garmin_revocation_outbox','garmin_push_jobs','account_journal_documents'])assert.equal((await admin(`select count(*) n from public.${table}`)).rows[0].n,0,table);
  assert.equal((await admin('select count(*) n from auth.users where id=$1',[other])).rows[0].n,1,'privacy erasure does not wait for later auth deletion worker');
  const row=(await admin('select state,credential from public.garmin_connections where user_id=$1',[other])).rows[0];assert.equal(row.state,'REVOKED');assert.equal(row.credential,null);
});
