import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createAccountGateway} from './service.mjs';
import {createNodeServer} from '../garmin-integration/service.mjs';
import {stableUuid} from '../garmin-integration/primitives.mjs';
import {loadOracleMigrationChain,approveSyntheticOracleStorage,admitOracleStorage,setOracleAuth} from '../../supabase/tests/local-postgres/oracle-auth-fixture.mjs';
import {compressFileJson,FILE_MUTATION_MAX_BYTES} from '../../supabase/functions/_shared/account-file-document-codec.mjs';
const require=createRequire(new URL('../../supabase/tests/local-postgres/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite'),{pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const appRequire=createRequire(new URL('../../app/package.json',import.meta.url));
const {build}=appRequire('esbuild'),{JSDOM}=appRequire('jsdom');
const db=new PGlite({extensions:{pgcrypto}}),owner=randomUUID(),other=randomUUID(),sid=randomUUID(),otherSid=randomUUID();
const jwt=(sub,session_id,role='authenticated')=>`synthetic.${Buffer.from(JSON.stringify({sub,session_id,role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.local`;
const token=jwt(owner,sid),otherToken=jwt(other,otherSid),anonKey=jwt(owner,sid,'anon');
const identities=new Map([[token,{ownerId:owner,sessionId:sid}],[otherToken,{ownerId:other,sessionId:otherSid}]]);
const origin='https://app.example.test',key=Buffer.alloc(32,83);
let backend,server,url,settings,source,document,documentId,dbQueue=Promise.resolve(),requests=[],lostAck=false;
const capabilities={supportedJournalVersions:[2,3,4,5],supportsExerciseLogV1:true,supportsLargeFileV1:true};
const admin=async(sql,args=[])=>{await db.exec('reset role');return db.query(sql,args);};
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
const close=server=>new Promise(resolve=>server.close(resolve));
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
before(async()=>{
  await loadOracleMigrationChain(db);await approveSyntheticOracleStorage(db);
  await admin("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','AUTH_OAUTH','FILE_ANALYSIS_WRITE')");
  for(const [u,s]of [[owner,sid],[other,otherSid]]){await admin('insert into auth.users(id,email_confirmed_at)values($1,clock_timestamp())',[u]);await admin("insert into auth.sessions(id,user_id,not_after)values($1,$2,clock_timestamp()+interval '1 hour')",[s,u]);await admitOracleStorage(db,u,s);}
  await admin("insert into public.account_journal_gateway_keys(key_id,secret,enabled)values('synthetic-company',$1,true)",[key]);
  backend=createServer(async(req,res)=>{
    const identity=identities.get(req.headers.authorization?.replace('Bearer ',''));
    if(!identity||req.headers.apikey!==anonKey)return json(res,401,{});
    const route=new URL(req.url,'http://localhost');requests.push({path:route.pathname,owner:identity.ownerId,revision:req.headers['x-trainoracle-storage-revision']});
    if(route.pathname==='/auth/v1/user')return json(res,200,{id:identity.ownerId});
    const chunks=[];for await(const chunk of req)chunks.push(chunk);let body;try{body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};}catch{return json(res,400,{});}
    const work=async()=>{try{
      await setOracleAuth(db,identity.ownerId,identity.sessionId);
      await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-trainoracle-storage-revision':req.headers['x-trainoracle-storage-revision']??''})]);
      const rpc={service_feature_enabled:['select public.service_feature_enabled($1) value',[body.feature_key_input]],account_network_access_allowed:['select public.account_network_access_allowed($1) value',[body.target_user]],
        mutate_account_journal_attested:['select public.mutate_account_journal_attested($1,$2,$3) value',[body.request_text,body.signature,body.key_id]],list_account_journal_history:['select public.list_account_journal_history($1) value',[body.document_id]]};
      if(route.pathname.startsWith('/rest/v1/rpc/')){
        const query=rpc[route.pathname.split('/').at(-1)];if(!query)return json(res,404,{});
        const result=(await db.query(...query)).rows[0].value;
        if(lostAck&&body.request_text&&JSON.parse(body.request_text).action==='commit'){lostAck=false;res.destroy();return;}
        return json(res,200,result);
      }
      const table=route.pathname.split('/').at(-1);if(!['account_journal_documents','account_journal_operations'].includes(table))return json(res,404,{});
      const columns=route.searchParams.get('select');assert.match(columns,/^[a-z_,]+$/);
      const values=[],where=[];for(const [column,value]of route.searchParams){if(['select','order','limit'].includes(column))continue;assert.ok(['user_id','document_id','operation_id'].includes(column));const [op,...rest]=value.split('.');assert.ok(['eq','gt'].includes(op));values.push(rest.join('.'));where.push(`${column}${op==='eq'?'=':'>'}$${values.length}`);}
      const order=route.searchParams.get('order');if(order)assert.equal(order,'document_id.asc');const limit=Number(route.searchParams.get('limit')??51);assert.ok(limit>=1&&limit<=51);
      const result=await db.query(`select ${columns} from public.${table} where ${where.join(' and ')}${order?' order by document_id':''} limit ${limit}`,values);return json(res,200,result.rows);
    }catch(error){return json(res,403,{code:error.code??'UNAVAILABLE'});}};
    dbQueue=dbQueue.then(work,work);await dbQueue;
  });
  const backendUrl=await listen(backend);
  settings={enabled:true,url:backendUrl,publishableKey:anonKey,attestationJson:JSON.stringify({keyId:'synthetic-company',key:key.toString('base64')}),keyringJson:JSON.stringify({activeKeyId:'synthetic',keys:{synthetic:Buffer.alloc(32,84).toString('base64')}}),allowedOrigins:[origin],allowLocalHttp:true};
  server=createNodeServer(createAccountGateway(settings).handler);url=await listen(server);
  const app=fileURLToPath(new URL('../../app/',import.meta.url));
  const bundled=await build({stdin:{contents:'export { largeFileJournalFixture } from "./src/test/large-file-journal-fixture.ts"; export { buildFileObservation } from "./src/domain/import/file-observation.ts";',resolveDir:app,loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',absWorkingDir:app,alias:{'@impl':fileURLToPath(new URL('../../impl/src',import.meta.url))},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"test"'}});
  source=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  const dom=new JSDOM();globalThis.DOMParser=dom.window.DOMParser;document=source.largeFileJournalFixture(14400);dom.window.close();
  documentId=stableUuid(['trainoracle.journal.record.v1',owner,document.entry.id]);
},{timeout:120000});
after(async()=>{await close(server);await close(backend);await db.close();});
async function call(body,{authorization=token,revision='1',requestOrigin=origin,target=url}={}){
  const response=await fetch(`${target}/api/account-journal`,{method:'POST',headers:{authorization:`Bearer ${authorization}`,'content-type':'application/json','x-trainoracle-storage-revision':revision,origin:requestOrigin},body:JSON.stringify(body)});
  return {status:response.status,data:await response.json(),headers:response.headers};
}
const compressed=async body=>({action:'compressedFileMutation',envelope:await compressFileJson({...body,...capabilities},FILE_MUTATION_MAX_BYTES)});

test('company runtime publishes its bounded capability; default off, auth, origin and request budget escalation stay closed',async()=>{
  const capability=await call({action:'journalLargeFileSupport'});assert.equal(capability.status,200);assert.equal(capability.data.maxCorrectionBytes,3500000);assert.equal(capability.headers.get('cache-control'),'no-store');
  assert.equal((await call({action:'journalLargeFileSupport',runtimeBudget:'COMPANY_NODE'})).status,400);
  const before=requests.length;assert.equal((await call({action:'status'},{requestOrigin:'https://evil.example'})).status,403);assert.equal(requests.length,before);
  assert.equal((await call({action:'status'},{authorization:'invalid'})).status,401);
  const disabled=createNodeServer(createAccountGateway().handler),target=await listen(disabled);try{assert.equal((await call({action:'status'},{target})).status,503);assert.equal(requests.length,before);}finally{await close(disabled);}
  assert.throws(()=>createAccountGateway({...settings,publishableKey:jwt(owner,sid,'service_role')}),/PUBLIC_KEY_REQUIRED/);
});

test('four-hour real HTTP/user-JWT/SQL/AES save-correct-reread uses existing storage and survives lost ACK without duplicate revision',async()=>{
  const body=await compressed({action:'save',documentId,operationId:randomUUID(),expectedRevision:0,document,writePurpose:'FILE_OBSERVATION'});
  let cpu=process.cpuUsage(),start=performance.now();const saved=await call(body),saveCpu=process.cpuUsage(cpu),saveMs=performance.now()-start;
  assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.revision,1);
  const observation=document.entry.fileObservation,{schemaVersion,source:ignoredSource,sourceObservationKey,contentRevisionFingerprint,completeness,...input}=observation;
  const replacement=source.buildFileObservation({...input,detail:{...observation.detail,samples:observation.detail.samples.map((sample,index)=>index===0?{...sample,metrics:{...sample.metrics,heartRateBpm:141}}:sample)}});
  const correction=await compressed({action:'correctImportedObservation',documentId,operationId:randomUUID(),expectedRevision:1,previousContentRevisionFingerprint:observation.contentRevisionFingerprint,replacementObservation:replacement,confirmedChangedFields:['detail']});
  cpu=process.cpuUsage();start=performance.now();lostAck=true;const ambiguous=await call(correction),correctionCpu=process.cpuUsage(cpu),correctionMs=performance.now()-start;
  assert.equal(ambiguous.status,503);const retry=await call(correction);assert.equal(retry.status,200,JSON.stringify(retry.data));assert.equal(retry.data.revision,2);
  const read=await call({action:'read',documentId,...capabilities});assert.equal(read.status,200);assert.equal(read.data.revision,2);assert.deepEqual(read.data.document.entry.fileObservation,replacement);
  assert.equal(read.data.document.entry.fileObservation.detail.samples.length,14400);
  const row=(await admin('select revision,encrypted_payload from public.account_journal_documents where user_id=$1 and document_id=$2',[owner,documentId])).rows[0];assert.equal(row.revision,2);assert.equal(JSON.stringify(row).includes('Synthetic measurement'),false);
  console.log(JSON.stringify({synthetic:true,profile:'COMPANY_NODE',samples:14400,documentBytes:Buffer.byteLength(JSON.stringify(document)),saveMs:Math.round(saveMs),saveCpuMs:Math.round((saveCpu.user+saveCpu.system)/1000),correctionMs:Math.round(correctionMs),correctionCpuMs:Math.round((correctionCpu.user+correctionCpu.system)/1000),sameDatabase:true,realProvider:false}));
});

test('existing SQL owner/session/consent boundaries still deny cross-owner access and erase on real synthetic withdrawal',async()=>{
  assert.equal((await call({action:'read',documentId,...capabilities},{authorization:otherToken})).status,404);
  await admin("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[sid]);assert.equal((await call({action:'read',documentId,...capabilities})).status,403);
  await admin("update auth.sessions set not_after=clock_timestamp()+interval '1 hour' where id=$1",[sid]);
  const doc2=structuredClone(document);doc2.entry.id='synthetic-other-large';const id2=stableUuid(['trainoracle.journal.record.v1',owner,doc2.entry.id]);
  const body=await compressed({action:'save',documentId:id2,operationId:randomUUID(),expectedRevision:0,document:doc2,writePurpose:'FILE_OBSERVATION'});
  assert.equal((await call(body,{revision:'2'})).status,403);
  await setOracleAuth(db,owner,sid);await db.query("select public.set_account_storage_consent($1,$2,1,'2026-10-05',false,false)",[owner,sid]);
  assert.equal((await call({action:'read',documentId,...capabilities})).status,403);assert.equal((await call(body)).status,403);
  assert.equal((await admin('select count(*)::int n from public.account_journal_documents where user_id=$1',[owner])).rows[0].n,0);
});
