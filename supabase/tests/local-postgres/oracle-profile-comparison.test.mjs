import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createProfileComparisonHandler, createProfileComparisonRepository, importProfileComparisonAttestor } from '../../functions/_shared/oracle-profile-comparison-handler.mjs';
import { encryptAccountJournalDocument } from '../../functions/_shared/account-journal-crypto.mjs';

// Real SQL + gateway + crypto with synthetic auth fixtures. No Supabase/network credentials.
const db = new PGlite({ extensions: { pgcrypto } });
const root = new URL('../../migrations/', import.meta.url);
const A=randomUUID(), B=randomUUID(), C=randomUUID(), SA=randomUUID(), SB=randomUUID(), SC=randomUUID();
const DA=randomUUID(), DB=randomUUID(), DC=randomUUID();
const identities = new Map([['A-token',{ownerId:A,sessionId:SA}],['B-token',{ownerId:B,sessionId:SB}],['C-token',{ownerId:C,sessionId:SC}]]);
const signing=Buffer.alloc(32,51); let material, attest, hook=null;
const future=()=>new Date(Date.now()+3600000).toISOString();
const fields=['CHALLENGE_1','CHALLENGE_2','SOCIAL_1'];
const profile=(answers)=>({version:3,state:'ACCOUNT_STATE',kind:'RUNNING_PROFILE',data:{version:'RUNNING_PROFILE_V2',status:'ACTIVE',legacyAnswers:{},legacyAnsweredAt:null,readings:[],current:{version:'ORACLE_PROFILE_REVISION_V2',revision:1,answeredAt:'2026-10-04T00:00:00.000Z',questionVersion:'ORACLE_QUESTIONS_V2_1',scoreVersion:'SELF_RESPONSE_INDEX_V1',characterVersion:'RESPONSE_NICKNAME_V1',selectedCharacter:null,answers}}});
async function admin(sql,params=[]) {await db.exec('reset role');return db.query(sql,params)}
async function auth(ownerId,sessionId,patch={}) {
  await db.exec('reset role;set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ownerId,JSON.stringify({sub:ownerId,role:'authenticated',session_id:sessionId,exp:Math.floor(Date.now()/1000)+3600,...patch})]);
}
function repo(identity) {
  return createProfileComparisonRepository({rpc:async(name,proof)=>{
    const request=JSON.parse(proof.request_text);
    if(hook)await hook(request);
    await auth(identity.ownerId,identity.sessionId);
    try{return {data:(await db.query('select public.oracle_profile_comparison_attested($1,$2,$3) value',[proof.request_text,proof.signature,proof.key_id])).rows[0].value,error:null}}
    catch(error){return {data:null,error:{code:error.code}}}
  }},{...identity,attest});
}
const handler=createProfileComparisonHandler({allowedOrigins:['http://127.0.0.1:5197'],getMaterial:async()=>({get:()=>material}),
  authenticate:async token=>{const identity=identities.get(token);return identity?{...identity,repo:repo(identity)}:null}});
async function call(token,input,extra={}) {
  const response=await handler(new Request('http://localhost/oracle-profile-comparison',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...extra},body:JSON.stringify(input)}));
  assert.equal(response.headers.get('cache-control'),'no-store');
  return {status:response.status,data:await response.json()};
}
const expiries=new Map();
const consent=(cid,_peerId,documentId,expiresAt=expiries.get(cid)??future())=>({action:'consent',comparisonId:cid,documentId,documentRevision:1,profileRevision:1,questionVersion:'ORACLE_QUESTIONS_V2_1',scoreVersion:'SELF_RESPONSE_INDEX_V1',fields,expiresAt});
async function invite() {
  const result=await call('A-token',{action:'createInvite',expiresAt:future()});
  assert.equal(result.status,200);
  expiries.set(result.data.comparisonId,result.data.expiresAt);
  return result.data;
}
async function pair() {
  const invitation=await invite(),cid=invitation.comparisonId;
  assert.equal((await call('B-token',{action:'acceptInvite',invitationCode:invitation.invitationCode})).status,200);
  assert.equal((await call('A-token',consent(cid,B,DA))).status,200);
  assert.equal((await call('B-token',consent(cid,A,DB))).status,200);
  return cid;
}
async function share(cid,token='A-token',selected=fields) {return call(token,{action:'allowExternal',comparisonId:cid,fields:selected,expiresAt:new Date(Date.now()+600000).toISOString()})}
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for(const name of readdirSync(root).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&n<'0061'&&!/^(0038|0039|0041|0042|005[1-6])_/.test(n)).sort())await db.exec(readFileSync(new URL(name,root),'utf8'));
  material={keyId:'synthetic',key:await crypto.subtle.importKey('raw',Buffer.alloc(32,23),'AES-GCM',false,['encrypt','decrypt'])};
  attest=await importProfileComparisonAttestor(JSON.stringify({keyId:'synthetic',key:signing.toString('base64')}));
  for(const [owner,sid,doc] of [[A,SA,DA],[B,SB,DB],[C,SC,DC]]) {
    await admin('insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())',[owner]);
    await admin('insert into auth.sessions(id,user_id) values($1,$2)',[sid,owner]);
    await admin("insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at) values($1,'1990-01-01','2026-08-26','2026-08-26',clock_timestamp())",[owner]);
    await admin('insert into public.beta_enrollments(user_id) values($1)',[owner]);
    const encrypted=await encryptAccountJournalDocument(JSON.stringify(profile({CHALLENGE_1:1,CHALLENGE_2:owner===B?2:1,SOCIAL_1:'UNKNOWN',WE_1:5})),{ownerId:owner,documentId:doc},material);
    await admin('insert into public.account_journal_documents(user_id,document_id,revision,encrypted_payload) values($1,$2,1,$3)',[owner,doc,encrypted]);
    await admin("insert into public.account_journal_identity(user_id,document_id,document_kind,active) values($1,$2,'RUNNING_PROFILE',true)",[owner,doc]);
  }
  await admin('insert into public.oracle_profile_comparison_keys(key_id,secret) values($1,$2)',['synthetic',signing]);
  await admin("update public.service_feature_controls set enabled=true where feature_key in('ACCOUNT','ACCOUNT_JOURNAL_V2','SHARING')");
},{timeout:120000});
after(()=>db.close());

test('default OFF, then bilateral consent yields numeric selected facts without public permission',async()=>{
  assert.equal((await call('A-token',{action:'createInvite',expiresAt:future()})).status,403);
  await admin('update public.oracle_profile_comparison_controls set enabled=true');
  const invitation=await invite(),input=consent(invitation.comparisonId,B,DA);
  assert.equal((await call('A-token',input)).status,403);
  assert.equal((await call('B-token',{action:'acceptInvite',invitationCode:invitation.invitationCode})).status,200);
  assert.equal((await call('A-token',input)).status,200);
  assert.equal((await call('A-token',{action:'compare',comparisonId:input.comparisonId})).status,403);
  assert.equal((await call('B-token',consent(input.comparisonId,A,DB))).status,200);
  const result=await call('A-token',{action:'compare',comparisonId:input.comparisonId});
  assert.equal(result.status,200);assert.equal(result.data.comparedCount,2);assert.equal(result.data.matchingCount,1);
  assert.deepEqual(result.data.rows.map(r=>r.questionId),['CHALLENGE_1','CHALLENGE_2']);
  assert.ok(!JSON.stringify(result.data).includes('encryptedPayload'));assert.ok(!JSON.stringify(result.data).includes('WE_1'));
  assert.equal((await call('C-token',{action:'compare',comparisonId:input.comparisonId})).status,403);
});
test('invitation binds one authenticated recipient, never grants consent, and stores no raw code',async()=>{
  const invitation=await invite(),cid=invitation.comparisonId,accept={action:'acceptInvite',invitationCode:invitation.invitationCode};
  assert.equal((await call('bad-token',accept)).status,401);
  assert.equal((await call('A-token',accept)).data.accepted,false);
  const accepted=await call('B-token',accept);assert.equal(accepted.status,200);assert.equal(accepted.data.accepted,true);
  assert.ok(!JSON.stringify(accepted.data).includes(A));assert.ok(!JSON.stringify(accepted.data).includes(B));
  assert.equal((await call('C-token',accept)).status,403);
  assert.equal((await call('C-token',{action:'invitationStatus',comparisonId:cid})).status,403);
  assert.equal((await call('B-token',{action:'compare',comparisonId:cid})).status,403);
  assert.equal((await admin('select count(*)::int n from public.oracle_profile_comparison_grants where comparison_id=$1',[cid])).rows[0].n,0);
  const stored=(await admin('select * from public.oracle_profile_comparison_invitations where comparison_id=$1',[cid])).rows[0];
  assert.ok(!JSON.stringify(stored).includes(invitation.invitationCode));
  await admin("update public.oracle_profile_comparison_invitations set expires_at=clock_timestamp()-interval '1 second' where comparison_id=$1",[cid]);
  assert.equal((await call('B-token',accept)).status,403);
  const withdrawn=await invite();
  assert.equal((await call('A-token',{action:'revoke',comparisonId:withdrawn.comparisonId})).status,200);
  assert.equal((await call('B-token',{action:'acceptInvite',invitationCode:withdrawn.invitationCode})).status,403);
});
test('external export needs separate consent from both owners and only their field intersection',async()=>{
  const cid=await pair();assert.equal((await call('A-token',{action:'export',comparisonId:cid})).status,403);
  assert.equal((await share(cid)).status,200);assert.equal((await call('A-token',{action:'export',comparisonId:cid})).status,403);
  assert.equal((await share(cid,'B-token',['CHALLENGE_1'])).status,200);
  const result=await call('A-token',{action:'export',comparisonId:cid});assert.equal(result.status,200);
  assert.match(result.data.text,/숫자 응답 1개 중 같은 답 1개/);assert.ok(!result.data.text.includes('WE_1'));
  assert.equal((await call('B-token',{action:'revokeExternal',comparisonId:cid})).status,200);
  assert.equal((await call('A-token',{action:'export',comparisonId:cid})).status,403);
  assert.equal((await call('A-token',{action:'compare',comparisonId:cid})).status,200);
  assert.equal((await share(cid,'B-token')).status,403);
});
test('comparison withdrawal is terminal, including withdrawal before the initial consent',async()=>{
  const cid=await pair();assert.equal((await call('B-token',{action:'revoke',comparisonId:cid})).status,200);
  assert.equal((await call('A-token',{action:'compare',comparisonId:cid})).status,403);
  assert.equal((await call('B-token',consent(cid,A,DB))).status,403);
  const early=randomUUID();assert.equal((await call('A-token',{action:'revoke',comparisonId:early})).status,200);
  assert.equal((await call('A-token',consent(early,B,DA))).status,403);
});
test('source changes, deletion and grant expiry deny, rather than serving stale results',async()=>{
  const cid=await pair();
  await admin('update public.account_journal_documents set revision=2 where user_id=$1',[B]);
  assert.equal((await call('A-token',{action:'compare',comparisonId:cid})).status,403);
  await admin('update public.account_journal_documents set revision=1 where user_id=$1',[B]);
  await admin('update public.account_journal_identity set active=false where user_id=$1',[B]);
  assert.equal((await call('A-token',{action:'compare',comparisonId:cid})).status,403);
  await admin('update public.account_journal_identity set active=true where user_id=$1',[B]);
  await admin("update public.oracle_profile_comparison_grants set expires_at=clock_timestamp()-interval '1 second' where comparison_id=$1 and owner_id=$2",[cid,B]);
  assert.equal((await call('A-token',{action:'compare',comparisonId:cid})).status,403);
});
test('revocation between source read and response verification suppresses all computed facts',async()=>{
  const cid=await pair();
  hook=async request=>{if(request.action==='verify'){hook=null;await admin('update public.oracle_profile_comparison_grants set revoked_at=clock_timestamp(),grant_revision=grant_revision+1 where comparison_id=$1 and owner_id=$2',[cid,B])}};
  const result=await call('A-token',{action:'compare',comparisonId:cid});hook=null;
  assert.equal(result.status,403);assert.deepEqual(result.data,{error:'COMPARISON_UNAVAILABLE'});
});
test('removed peer session and banned/deleted account cannot be treated as valid grants',async()=>{
  const cid=await pair();
  for(const [column,value,restore] of [['banned_until',new Date(Date.now()+3600000).toISOString(),null],['deleted_at',new Date().toISOString(),null],['is_anonymous',true,false]]) {
    await admin(`update auth.users set ${column}=$1 where id=$2`,[value,B]);
    assert.equal((await call('A-token',{action:'compare',comparisonId:cid})).status,403);
    await admin(`update auth.users set ${column}=$1 where id=$2`,[restore,B]);
  }
  await admin('delete from auth.sessions where id=$1',[SB]);
  assert.equal((await call('A-token',{action:'compare',comparisonId:cid})).status,403);
  await admin('insert into auth.sessions(id,user_id) values($1,$2)',[SB,B]);
});
test('feature OFF still allows withdrawal and no public snapshot is a fallback grant',async()=>{
  const cid=await pair();await admin('update public.oracle_profile_comparison_controls set enabled=false');
  assert.equal((await call('A-token',{action:'compare',comparisonId:cid})).status,403);
  assert.equal((await call('A-token',{action:'revoke',comparisonId:cid})).status,200);
  await admin('update public.oracle_profile_comparison_controls set enabled=true');
});
test('malformed/memo/version/owner injections, unauthenticated and cross-origin requests fail closed',async()=>{
  for(const patch of [{rawmemo:'PRIVATE_SENTINEL'},{ownerId:B},{fields:['rawmemo']},{questionVersion:'OLD'},{scoreVersion:'OLD'}])assert.equal((await call('A-token',{...consent(randomUUID(),B,DA),...patch})).status,400);
  assert.equal((await call('bad-token',consent(randomUUID(),B,DA))).status,401);
  assert.equal((await call('A-token',consent(randomUUID(),B,DA),{origin:'https://untrusted.invalid'})).status,403);
  assert.equal((await call('A-token',{action:'source',comparisonId:randomUUID(),documentId:DB,documentRevision:1})).status,400);
  assert.equal((await call('A-token',consent(randomUUID(),B,DB))).status,403);
});
test('direct tables/helper/RPC are inaccessible without exact session-bound gateway proof',async()=>{
  await auth(A,SA);
  for(const name of ['grants','keys','controls','withdrawals','invitations'])await assert.rejects(()=>db.query(`select * from public.oracle_profile_comparison_${name}`),e=>e.code==='42501');
  await assert.rejects(()=>db.query('select public.oracle_profile_comparison_subject_allowed($1,$2)',[B,SB]),e=>e.code==='42501');
  const raw=JSON.stringify({domain:'trainoracle.profile-comparison.gateway.v1',ownerId:A,sessionId:SB,action:'status',comparisonId:randomUUID(),proofExpiresAt:Math.floor(Date.now()/1000)+90});
  await assert.rejects(()=>db.query('select public.oracle_profile_comparison_attested($1,$2,$3)',[raw,createHmac('sha256',signing).update(raw).digest('hex'),'synthetic']),e=>e.code==='42501');
  await assert.rejects(()=>db.query('select public.oracle_profile_comparison_attested($1,$2,$3)',[raw,'0'.repeat(64),'synthetic']),e=>e.code==='42501');
  await db.exec('reset role;set role anon');
  await assert.rejects(()=>db.query('select public.oracle_profile_comparison_attested($1,$2,$3)',[raw,'0'.repeat(64),'synthetic']),e=>e.code==='42501');
});
