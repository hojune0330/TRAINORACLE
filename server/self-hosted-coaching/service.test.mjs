import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createSupabaseRepository, createCompanyInference, createCoachingHandler, createNodeServer, sourcePermission } from './service.mjs';
import { registerReviewedSource } from './register-source.mjs';
import { buildFileObservation } from './contracts.mjs';
import { encryptAccountJournalDocument } from '../../supabase/functions/_shared/account-journal-crypto.mjs';
import { loadOracleMigrationChain, approveSyntheticOracleStorage, admitOracleStorage, setOracleAuth } from '../../supabase/tests/local-postgres/oracle-auth-fixture.mjs';

// The existing project's pinned PGlite dependency. No real credentials, provider,
// AI endpoint or network outside numeric loopback is used by this suite.
const require = createRequire(new URL('../../supabase/tests/local-postgres/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const owner = randomUUID(), otherOwner = randomUUID(), session = randomUUID(), otherSession = randomUUID(), documentId = randomUUID();
const signing = Buffer.alloc(32, 44), keyId = 'synthetic-coaching-only';
const tokenFor = (sub, sid) => `synthetic.${Buffer.from(JSON.stringify({ sub, session_id: sid, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.test`;
const token = tokenFor(owner, session), otherToken = tokenFor(otherOwner, otherSession);
const tokens = new Map([[token,{ownerId:owner,sessionId:session}],[otherToken,{ownerId:otherOwner,sessionId:otherSession}]]);
const lineage = { schemaVersion: 'PROVIDER_DATA_LINEAGE_V1', sources: [{ sourceId: 'garmin-fixture', originProvider: 'GARMIN', transport: 'PROVIDER_API', assurance: 'PROVIDER_VERIFIED' }], fieldSources: { distanceKm: ['garmin-fixture'], durationMin: ['garmin-fixture'] } };
const grant = { grantId: 'synthetic-grant', originProvider: 'GARMIN', applicationId: 'TRAINORACLE', purpose: 'SELF_HOSTED_INFERENCE', hosting: 'COMPANY_SELF_HOSTED', approvedFields: ['distanceKm','durationMin'], approvedTransports: ['PROVIDER_API'], validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z', active: true, evidenceReference: 'SYNTHETIC_LOCAL_TEST_ONLY', noTraining: true, retention: 'REQUEST_ONLY' };
let supabaseServer, modelServer, apiServer, apiUrl, material, repository, intakeRepository, infer;
let calls = [], modelMode = 'valid', modelHook = null;
const admin = async (sql, params=[]) => { await db.exec('reset role'); return db.query(sql,params); };
const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve=>server.close(resolve));
const body = async request => { const chunks=[];for await(const chunk of request) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); };
const json = (response,status,value) => {response.writeHead(status,{'content-type':'application/json'});response.end(JSON.stringify(value));};

before(async () => {
  await loadOracleMigrationChain(db);
  // The candidate has no dependency on later collection/lounging changes.
  for (const name of ['0063_lounge_identity_deletion_outbox.sql','0064_minigame_progress_account_storage.sql','0065_lounge_grant_auth_channel_recheck.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8'));
  }
  await db.exec(await readFile(new URL('./schema-candidate.sql',import.meta.url),'utf8'));
  await approveSyntheticOracleStorage(db);
  await admin("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','AUTH_OAUTH')");
  for (const [u,s] of [[owner,session],[otherOwner,otherSession]]) {
    await admin('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())',[u]);
    await admin("insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval '1 hour')",[s,u]);
    await admitOracleStorage(db,u,s);
  }
  material = { keyId: 'synthetic-encryption-only', key: await crypto.subtle.importKey('raw',Buffer.alloc(32,22),'AES-GCM',false,['encrypt','decrypt']) };
  const document = { version: 2, state: 'FINALIZED', kind: 'JOURNAL', entry: { id: 'synthetic-journal-entry', kind: 'post-session', date: '2026-10-30', savedAt:'2026-10-30T00:00:00.000Z',syncState:'local',system:'endurance',distanceKm: '10.5', durationMin: '60', avgPace:'',rpe:0,title: 'PRIVATE_TITLE_CANARY', memo: 'PRIVATE_MEMO_CANARY PRIVATE_GPS_CANARY',memoPurpose:'ANALYZABLE_TRAINING_NOTE',fieldProvenance:{distanceKm:{provenance:'EXPLICIT'},durationMin:{provenance:'EXPLICIT'}} } };
  const payload = await encryptAccountJournalDocument(JSON.stringify(document),{ownerId:owner,documentId},material);
  await admin("select set_config('request.headers','{\"x-trainoracle-storage-revision\":\"1\"}',false)");
  await admin('insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)',[owner,documentId,payload]);
  await admin('insert into public.self_hosted_coaching_keys(key_id,secret,enabled) values($1,$2,true)',[keyId,signing]);
  await admin("insert into public.self_hosted_coaching_keys(key_id,secret,enabled,scope) values($1,$2,true,'INTAKE')",['synthetic-intake',Buffer.alloc(32,55)]);
  await admin("insert into public.self_hosted_coaching_controls(singleton,approved,evidence_reference) values(true,true,'SYNTHETIC_LOCAL_TEST_ONLY')");
  await admin('insert into public.self_hosted_coaching_sources(user_id,document_id,document_revision,record_date,lineage,confirmed,analysis_eligible) values($1,$2,1,$3,$4,true,true)',[owner,documentId,'2026-10-30',lineage]);
  supabaseServer = createServer(async(req,res)=> {
    try {
      const identity=tokens.get(req.headers.authorization?.replace('Bearer ',''));
      if(!identity) return json(res,401,{error:'invalid'});
      if(req.url==='/auth/v1/user') return json(res,200,{id:identity.ownerId});
      if(req.url!=='/rest/v1/rpc/self_hosted_coaching_attested') return json(res,404,{});
      const proof=await body(req);
      await setOracleAuth(db,identity.ownerId,identity.sessionId);
      const result=await db.query('select public.self_hosted_coaching_attested($1,$2,$3) value',[proof.request_text,proof.signature,proof.key_id]);
      json(res,200,result.rows[0].value);
    } catch { json(res,403,{error:'denied'}); }
  });
  const supabaseUrl=await listen(supabaseServer);
  modelServer=createServer(async(req,res)=> {
    const input=await body(req); calls.push({input,headers:req.headers});
    if(modelHook) await modelHook();
    if(modelMode==='redirect') { res.writeHead(302,{Location:'http://127.0.0.1:9/forbidden'});return res.end(); }
    if(modelMode==='oversize') return json(res,200,{huge:'x'.repeat(20000)});
    if(modelMode==='delay') { setTimeout(()=>json(res,200,{}),100);return; }
    const context=JSON.parse(input.messages[1].content);
    const selected=modelMode==='invented' ? {summaryId:'OBSERVED_TOTALS',factIds:['NEW_PACE'],actionIds:['ACTIVATE_PLAN']}
      : {summaryId:context.summaryIds[0],factIds:context.facts.slice(0,2).map(f=>f.id),actionIds:['REVIEW_JOURNAL']};
    json(res,200,{choices:[{finish_reason:'stop',message:{content:JSON.stringify(selected)}}]});
  });
  const modelUrl=await listen(modelServer);
  repository=createSupabaseRepository({url:supabaseUrl,publishableKey:'synthetic-public-key',attestation:{keyId,key:signing.toString('base64')},keyring:{get:()=>material},allowLocalHttp:true});
  intakeRepository=createSupabaseRepository({url:supabaseUrl,publishableKey:'synthetic-public-key',attestation:{keyId:'synthetic-intake',key:Buffer.alloc(32,55).toString('base64')},keyring:{get:()=>material},allowLocalHttp:true});
  infer=createCompanyInference({endpoint:`${modelUrl}/v1/chat/completions`,allowedOrigin:modelUrl,model:'synthetic-model',token:'INTERNAL_ONLY_CANARY',allowLocalHttp:true});
  apiServer=createNodeServer(createCoachingHandler({repository,infer,enabled:true,allowedOrigins:['https://app.example.test']}));
  apiUrl=await listen(apiServer);
},{timeout:120000});

beforeEach(async()=> {
  calls=[];modelMode='valid';modelHook=null;
  await admin('update public.self_hosted_coaching_controls set approved=true');
  await admin('delete from public.self_hosted_coaching_provider_grants');
  await admin('insert into public.self_hosted_coaching_provider_grants values($1,$2,1)',[grant.grantId,grant]);
  await admin('update public.self_hosted_coaching_sources set lineage=$1,confirmed=true,analysis_eligible=true,document_revision=1',[lineage]);
  await admin('delete from public.self_hosted_coaching_consents');
  assert.equal((await call({action:'consent',documentIds:[documentId],documentRevisions:[{documentId,revision:1}],expectedConsentRevision:0,purposeVersion:'2026-10-30'})).status,200);
});
after(async()=> {if(apiServer)await close(apiServer);if(modelServer)await close(modelServer);if(supabaseServer)await close(supabaseServer);await db.close();});

async function call(input,options={}) {
  const response=await fetch(`${options.url??apiUrl}/api/self-hosted-coaching`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${options.token??token}`,origin:options.origin??'https://app.example.test'},body:JSON.stringify(input)});
  assert.equal(response.headers.get('cache-control'),'no-store');
  return {status:response.status,data:await response.json()};
}
const request=()=>({action:'infer',documentIds:[documentId],consentRevision:1});

test('real HTTP -> authenticated SQL -> AES-GCM projection -> company inference -> verified grounded response',async()=> {
  const status=await call({action:'status'});assert.equal(status.data.records[0].journalEntryId,'synthetic-journal-entry');
  const result=await call(request());
  assert.equal(result.status,200);assert.equal(calls.length,1);
  assert.deepEqual(result.data.facts.map(f=>f.value),[10.5,60]);
  assert.equal(result.data.planChanged,false);assert.equal(result.data.safetyChanged,false);assert.deepEqual(result.data.attribution,['GARMIN']);
  const sent=JSON.stringify(calls[0].input);
  for(const secret of ['PRIVATE_TITLE_CANARY','PRIVATE_MEMO_CANARY','PRIVATE_GPS_CANARY',owner,documentId,token]) assert.ok(!sent.includes(secret));
  assert.equal(calls[0].input.store,false);assert.equal(calls[0].input.stream,false);
  assert.equal(calls[0].headers.authorization,'Bearer INTERNAL_ONLY_CANARY');
  assert.ok(!JSON.stringify(result).includes('INTERNAL_ONLY_CANARY'));
});
test('missing provider grant denies before model while status reports pending source',async()=> {
  await admin('delete from public.self_hosted_coaching_provider_grants');
  assert.equal((await call(request())).status,409);assert.equal(calls.length,0);
  const status=await call({action:'status'});assert.equal(status.status,200);assert.equal(status.data.records[0].reason,'PROVIDER_APPROVAL_PENDING');
});
test('unknown, user-declared third-party and mixed indirect Garmin sources cannot bypass grant',async()=> {
  for(const patch of [{originProvider:'UNKNOWN'},{assurance:'USER_DECLARED'}]) {
    const changed=structuredClone(lineage);Object.assign(changed.sources[0],patch);
    await admin('update public.self_hosted_coaching_sources set lineage=$1',[changed]);
    assert.equal((await call(request())).status,409);
  }
  const mixed=structuredClone(lineage);mixed.sources[0].transport='HEALTHKIT';
  await admin('update public.self_hosted_coaching_sources set lineage=$1',[mixed]);
  assert.equal((await call(request())).status,409);assert.equal(calls.length,0);
});
test('direct user source can work without Garmin grant and is not mislabeled Garmin',async()=> {
  const direct={...lineage,sources:[{sourceId:'garmin-fixture',originProvider:'USER',transport:'DIRECT_INPUT',assurance:'USER_DECLARED'}]};
  await admin('delete from public.self_hosted_coaching_provider_grants');
  await admin('update public.self_hosted_coaching_sources set lineage=$1',[direct]);
  assert.equal((await call({action:'consent',documentIds:[documentId],documentRevisions:[{documentId,revision:1}],expectedConsentRevision:1,purposeVersion:'2026-10-30'})).status,200);
  const result=await call({...request(),consentRevision:2});assert.equal(result.status,200);assert.deepEqual(result.data.attribution,[]);
});
test('consent withdrawal persists and blocks inference; stale revision cannot re-enable consent',async()=> {
  const withdrawn=await call({action:'withdraw',expectedConsentRevision:1});assert.equal(withdrawn.status,200);assert.equal(withdrawn.data.consent.active,false);
  assert.equal((await call(request())).status,409);assert.equal(calls.length,0);
  assert.equal((await call({action:'consent',documentIds:[documentId],documentRevisions:[{documentId,revision:1}],expectedConsentRevision:1,purposeVersion:'2026-10-30'})).status,409);
  const accepted=await call({action:'consent',documentIds:[documentId],documentRevisions:[{documentId,revision:1}],expectedConsentRevision:2,purposeVersion:'2026-10-30'});assert.equal(accepted.status,200);assert.equal(accepted.data.consent.revision,3);
});
test('revocation during inference suppresses response',async()=> {
  modelHook=()=>admin('update public.self_hosted_coaching_consents set active=false,revision=revision+1');
  const result=await call(request());assert.equal(result.status,409);assert.deepEqual(result.data,{error:'CONSENT_CHANGED'});assert.equal(calls.length,1);
});
test('grant revocation or operations kill during inference suppresses response',async()=> {
  modelHook=()=>admin('delete from public.self_hosted_coaching_provider_grants');
  assert.equal((await call(request())).status,409);
  await admin('insert into public.self_hosted_coaching_provider_grants values($1,$2,1)',[grant.grantId,grant]);
  modelHook=()=>admin('update public.self_hosted_coaching_controls set approved=false');
  assert.equal((await call(request())).status,403);
});
test('another account, invalid token, supplied metrics and untrusted origins never call model',async()=> {
  assert.equal((await call(request(),{token:otherToken})).status,409);
  assert.equal((await call(request(),{token:'bad-token'})).status,401);
  assert.equal((await call({...request(),distanceKm:100})).status,400);
  assert.equal((await call(request(),{origin:'https://evil.example.test'})).status,403);assert.equal(calls.length,0);
});
test('model invented numbers/actions, redirects and oversized responses fail closed',async()=> {
  for(const mode of ['invented','redirect','oversize']) {modelMode=mode;assert.equal((await call(request())).status,502);}
});
test('operations off preserves actual consent status and withdrawal',async()=> {
  const stopped=createNodeServer(createCoachingHandler({repository,infer,enabled:false,allowedOrigins:['https://app.example.test']}));
  const url=await listen(stopped);
  try {
    const status=await call({action:'status'},{url});assert.equal(status.data.capability.enabled,false);assert.equal(status.data.consent.active,true);
    assert.equal((await call(request(),{url})).status,503);
    assert.equal((await call({action:'withdraw',expectedConsentRevision:1},{url})).data.consent.active,false);assert.equal(calls.length,0);
  } finally {await close(stopped);}
});
test('database rights are inaccessible to authenticated client and unsigned RPC fails',async()=> {
  await setOracleAuth(db,owner,session);
  await assert.rejects(db.query('select * from public.self_hosted_coaching_provider_grants'));
  await assert.rejects(db.query('select public.self_hosted_coaching_attested($1,$2,$3)',['{}','0'.repeat(64),keyId]));
});
test('configuration rejects non-company origin, insecure remote and unsupported endpoint paths',()=> {
  for(const options of [
    {endpoint:'https://public.example/v1/chat/completions',allowedOrigin:'https://company.example'},
    {endpoint:'http://company.example/v1/chat/completions',allowedOrigin:'http://company.example'},
    {endpoint:'https://company.example/v1/train',allowedOrigin:'https://company.example'},
  ]) assert.throws(()=>createCompanyInference({...options,model:'example'}));
  assert.equal(sourcePermission({...lineage,fieldSources:{}},[grant]),'SOURCE_REVIEW_REQUIRED');
});
test('status selection revision and consent source snapshot cannot silently change',async()=> {
  const stale=await call({action:'consent',documentIds:[documentId],documentRevisions:[{documentId,revision:2}],expectedConsentRevision:1,purposeVersion:'2026-10-30'});
  assert.equal(stale.status,409);assert.equal(stale.data.error,'SOURCE_CHANGED');
  const changed=structuredClone(lineage);changed.sources[0].sourceId='changed-source';changed.fieldSources={distanceKm:['changed-source'],durationMin:['changed-source']};
  await admin('update public.self_hosted_coaching_sources set lineage=$1',[changed]);
  assert.equal((await call(request())).status,409);assert.equal(calls.length,0);
});
test('owner intake uses separate key, dry run and canonical revision recheck',async()=> {
  const review={version:'COACHING_SOURCE_REVIEW_V1',documentId,revision:1,lineage,evidenceReference:'SYNTHETIC_OWNER_REVIEW',reviewedAt:new Date(Date.now()-1000).toISOString(),confirmed:true,analysisEligible:true};
  assert.deepEqual(await registerReviewedSource({repository:intakeRepository,token,review}),{validated:true,applied:false});
  assert.equal((await admin('select evidence_reference from public.self_hosted_coaching_sources where document_id=$1',[documentId])).rows[0].evidence_reference,null);
  await assert.rejects(registerReviewedSource({repository,token,review,apply:true}));
  assert.deepEqual(await registerReviewedSource({repository:intakeRepository,token,review,apply:true}),{validated:true,applied:true});
  assert.equal((await admin('select evidence_reference from public.self_hosted_coaching_sources where document_id=$1',[documentId])).rows[0].evidence_reference,'SYNTHETIC_OWNER_REVIEW');
  await assert.rejects(registerReviewedSource({repository:intakeRepository,token,review:{...review,revision:99},apply:true}));
  assert.equal((await call({action:'registerSource',...review})).status,400);assert.equal(calls.length,0);
});
test('company model timeout fails closed within bounded request duration',async()=> {
  modelMode='delay';
  const origin=`http://127.0.0.1:${modelServer.address().port}`;
  const timed=createCompanyInference({endpoint:`${origin}/v1/chat/completions`,allowedOrigin:origin,model:'synthetic-model',timeoutMs:15,allowLocalHttp:true});
  await assert.rejects(timed([{id:'TOTAL_DISTANCE',value:10,unit:'km'}]),error=>error.message==='INFERENCE_UNAVAILABLE');
});
test('canonical TCX owner intake -> explicit consent -> grouped inference; disabled format and source erasure denied',async()=> {
  const fileId=randomUUID();
  const fileLineage={schemaVersion:'PROVIDER_DATA_LINEAGE_V1',sources:[{sourceId:'garmin-file',originProvider:'GARMIN',transport:'FILE_UPLOAD',assurance:'PROVIDER_VERIFIED'}],fieldSources:{distanceMeters:['garmin-file'],durationSeconds:['garmin-file'],sport:['garmin-file'],durationMeaning:['garmin-file']}};
  const observation=buildFileObservation({format:'tcx',sourceProfile:'TCX_ACTIVITY_V1',parserVersion:'tcx-1',sourceActivityId:'synthetic-tcx',date:'2026-10-30',startedAt:null,timeZone:null,sport:'RUNNING',distanceMeters:5000,durationSeconds:1800,durationMeaning:'TIMER',laps:[{sourceIndex:0,distanceMeters:5000,durationSeconds:1800,durationMeaning:'TIMER',kind:'UNKNOWN'}],confirmation:{sport:null,durationMeaning:null},dataLineage:fileLineage});
  const document={version:3,state:'FINALIZED',kind:'JOURNAL',entry:{id:'synthetic-tcx-journal',kind:'post-session',date:'2026-10-30',savedAt:'2026-10-30T00:00:00Z',syncState:'local',system:'',title:'PRIVATE_FILE_TITLE',distanceKm:'999',durationMin:'999',avgPace:'',rpe:0,memo:'PRIVATE_FILE_MEMO',memoPurpose:'ANALYZABLE_TRAINING_NOTE',fileObservation:observation,fieldProvenance:{distanceKm:{provenance:'DERIVED',derivedFrom:['import:activity-file'],derivationRuleId:'import:tcx'},durationMin:{provenance:'DERIVED',derivedFrom:['import:activity-file'],derivationRuleId:'import:tcx'}}}};
  const payload=await encryptAccountJournalDocument(JSON.stringify(document),{ownerId:owner,documentId:fileId},material);
  await admin("select set_config('request.headers','{\"x-trainoracle-storage-revision\":\"1\"}',false)");
  await admin('insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)',[owner,fileId,payload]);
  const review={version:'COACHING_SOURCE_REVIEW_V1',documentId:fileId,revision:1,lineage:fileLineage,evidenceReference:'SYNTHETIC_TCX_RECEIPT',reviewedAt:new Date(Date.now()-1000).toISOString(),confirmed:true,analysisEligible:true};
  await assert.rejects(registerReviewedSource({repository:intakeRepository,token,review,apply:true}));
  const erased=structuredClone(fileLineage);erased.sources[0]={sourceId:'garmin-file',originProvider:'USER',transport:'DIRECT_INPUT',assurance:'USER_DECLARED'};
  await assert.rejects(registerReviewedSource({repository:intakeRepository,token,review:{...review,lineage:erased},allowedFormats:['tcx'],apply:true}));
  assert.deepEqual(await registerReviewedSource({repository:intakeRepository,token,review,allowedFormats:['tcx'],apply:true}),{validated:true,applied:true});
  const fileGrant={...grant,approvedFields:['distanceMeters','durationSeconds','sport','durationMeaning'],approvedTransports:['FILE_UPLOAD']};
  await admin('update public.self_hosted_coaching_provider_grants set grant_document=$1',[fileGrant]);
  const fileServer=createNodeServer(createCoachingHandler({repository,infer,enabled:true,allowedFormats:['tcx'],allowedOrigins:['https://app.example.test']}));
  const url=await listen(fileServer);
  try {
    const consent=await call({action:'consent',documentIds:[fileId],documentRevisions:[{documentId:fileId,revision:1}],expectedConsentRevision:1,purposeVersion:'2026-10-30'},{url});
    assert.equal(consent.status,200);
    const result=await call({action:'infer',documentIds:[fileId],consentRevision:2},{url});
    assert.equal(result.status,200);assert.deepEqual(result.data.facts.map(f=>f.value),[5,30]);
    assert.ok(result.data.facts[1].label.includes('타이머'));assert.ok(result.data.facts.every(f=>f.unit!=='sec/km'));
    const sent=JSON.stringify(calls.at(-1).input);assert.ok(!sent.includes('999'));assert.ok(!sent.includes('PRIVATE_FILE'));
    assert.ok(sent.includes('달리기'));assert.ok(sent.includes('타이머'));
    // An additional explicit avgPace grant permits the existing accepted ratio,
    // after new consent to that changed permission manifest.
    await admin('update public.self_hosted_coaching_provider_grants set grant_document=$1',[{...fileGrant,approvedFields:[...fileGrant.approvedFields,'avgPace']}]);
    assert.equal((await call({action:'infer',documentIds:[fileId],consentRevision:2},{url})).status,409);
    assert.equal((await call({action:'consent',documentIds:[fileId],documentRevisions:[{documentId:fileId,revision:1}],expectedConsentRevision:2,purposeVersion:'2026-10-30'},{url})).status,200);
    const withPace=await call({action:'infer',documentIds:[fileId],consentRevision:3},{url});assert.equal(withPace.status,200);
    assert.deepEqual(withPace.data.facts.map(f=>f.value),[5,30,360]);
  } finally {await close(fileServer);await admin('delete from public.self_hosted_coaching_sources where document_id=$1',[fileId]);}
});
