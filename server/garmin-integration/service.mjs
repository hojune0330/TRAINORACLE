import { createServer } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { encryptAccountJournalDocument } from '../../supabase/functions/_shared/account-journal-crypto.mjs';
import { accountJournalMetadata, importJournalAttestor, importJournalKeyring, validateAccountJournalDocument } from '../../supabase/functions/_shared/account-journal-handler.mjs';
import { VERSION, UUID, ID, exact, fail, IntegrationError, canonical, sha, sign, sameSignature, nonce, stableUuid, boundedJson, keyBytes, createVault, prepareObservation, prepareDetail } from './primitives.mjs';
import { createSupabaseRepository } from './repository.mjs';
import {createGarminStarterProvider} from './garmin-starter.mjs';
import {createGarminPushRuntime} from './push.mjs';

const context=(ownerId,connectionId,epoch,purpose,record='')=>({ownerId,connectionId,epoch,purpose,record});
const credentialsContext=(ownerId,connectionId,epoch)=>context(ownerId,connectionId,epoch,'credentials');
const rowContext=row=>context(row.user_id,row.connection_id,row.epoch,'observation',`${row.inbox_id}:${row.source_revision}`);
const connection=value=>value??{state:'DISCONNECTED',epoch:null,lastSyncAt:null};
function dateFor(observation){const p=new Intl.DateTimeFormat('en-CA',{timeZone:observation.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(observation.startedAt));return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
const positive=v=>Number.isSafeInteger(v)&&v>0;
function validateInput(input){
  if(!input||typeof input.action!=='string')fail(422,'INVALID_INPUT');
  const shapes={status:['action'],connect:['action'],complete:['action','code','state'],inbox:['action','cursor'],read:['action','documentId'],detail:['action','inboxId','expectedRevision','partIndex'],confirm:['action','inboxId','expectedRevision','operationId'],dismiss:['action','inboxId','expectedRevision','operationId'],disconnect:['action'],refresh:['action']};
  const allowed=shapes[input.action];if(!allowed||!exact(input,allowed,input.action==='inbox'?['action']:allowed))fail(422,'INVALID_INPUT');
  for(const id of ['inboxId','documentId','operationId','cursor'])if(input[id]!==undefined&&!UUID.test(input[id]))fail(422,'INVALID_INPUT');
  if(input.expectedRevision!==undefined&&!positive(input.expectedRevision))fail(422,'INVALID_INPUT');
  if(input.action==='detail'&&(!Number.isInteger(input.partIndex)||input.partIndex<0||input.partIndex>31))fail(422,'INVALID_INPUT');
  if(input.action==='complete'&&(typeof input.code!=='string'||input.code.length<1||input.code.length>2048||typeof input.state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.state)))fail(422,'INVALID_INPUT');
  return input;
}

/** A bounded journal bridge: only a confirmed server-stored snapshot is projected.
 * No FILE_UPLOAD/TCX provenance, subjective safety response, plan completion, AI
 * eligibility or pace is manufactured. The original provider observation stays in
 * the encrypted provider store and is retrievable by its journal document ID. */
export function providerJournalDocument(auth,row,observation,clock=null) {
  const journalEntryId=`garmin-${stableUuid(['trainoracle.garmin.entry.v1',auth.ownerId,row.activity_hash])}`;
  const documentId=stableUuid(['trainoracle.journal.record.v1',auth.ownerId,journalEntryId]);
  const fields={distanceKm:observation.distanceMeters===null?'':String(observation.distanceMeters/1000),durationMin:observation.durationSeconds===null?'':String(observation.durationSeconds/60)};
  const document={version:2,state:'FINALIZED',kind:'JOURNAL',entry:{id:journalEntryId,kind:'post-session',date:clock?.localDate??dateFor(observation),savedAt:new Date(row.received_at).toISOString(),syncState:'local',system:'',title:'Garmin 운동',...fields,avgPace:'',rpe:0,memo:'',memoPurpose:'ANALYZABLE_TRAINING_NOTE',fieldProvenance:Object.fromEntries(Object.entries(fields).map(([field,value])=>[field,value===''?{provenance:'MISSING'}:{provenance:'DERIVED',derivedFrom:['import:provider-activity'],derivationRuleId:'import:GARMIN:provider-v1'}]))}};
  if(!validateAccountJournalDocument(document))fail(503,'JOURNAL_CONTRACT_UNAVAILABLE');
  return {documentId,journalEntryId,document};
}

export function createGarminHandler({repository,vault,provider,identityKey,relayHttpKey,journalKeyring,journalAttest,push,allowedOrigins=[],enabled=false,now=()=>Date.now()}) {
  const origins=new Set(allowedOrigins);const configHash=provider?.configHash??'0'.repeat(64);
  const ensureProvider=()=>{if(!enabled||!provider||!provider.isCurrent())fail(503,'PROVIDER_CONFIGURATION_PENDING');};
  const subjectHash=subject=>sign(identityKey,`garmin-subject-v1:${subject}`);
  async function decode(row){if(!row.encrypted_observation||row.state==='DELETED')return null;return vault.open(row.encrypted_observation,rowContext(row));}
  async function sourceContext(row){return row.encrypted_context?vault.open(row.encrypted_context,context(row.user_id,row.connection_id,row.epoch,'source-context',`${row.inbox_id}:${row.source_revision}`)):null;}
  async function item(row){const source=await sourceContext(row);return {inboxId:row.inbox_id,revision:row.source_revision,state:row.state,provider:'GARMIN',observation:await decode(row),documentId:row.document_id,detailManifest:row.detail_manifest,clock:source?.clock??null,source:source?{manual:source.manual,parent:source.parent,summaryId:source.summaryId,lapStartOffsetsSeconds:source.lapStartOffsetsSeconds,...(source.summary?{summary:source.summary}:{})}:null};}
  return async (request,transport={})=>{
    const origin=request.headers.get('origin');const headers={'content-type':'application/json','cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...(origin&&origins.has(origin)?{'access-control-allow-origin':origin,'vary':'Origin'}:{})};
    const respond=(status,value)=>new Response(JSON.stringify(status<400?{schemaVersion:VERSION,...value}:value),{status,headers});
    try{
      const path=new URL(request.url).pathname;
      if(!['/api/garmin-integration','/internal/garmin/events','/internal/garmin/revocations','/internal/garmin/process','/webhooks/garmin'].includes(path))return respond(404,{error:'NOT_FOUND'});
      if(request.method==='OPTIONS'){if(!origin||!origins.has(origin)||path!=='/api/garmin-integration')return respond(403,{error:'ACCESS_DENIED'});return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, content-type, x-trainoracle-storage-revision','access-control-max-age':'0'}});}
      if(request.method!=='POST')return respond(405,{error:'METHOD_NOT_ALLOWED'});
      if(origin&&!origins.has(origin))fail(403,'ACCESS_DENIED');
      if(!repository||!vault)fail(503,'OPERATIONS_PENDING');
      if(path==='/webhooks/garmin'){if(!push)fail(503,'PROVIDER_CONFIGURATION_PENDING');return respond(200,await push.ingress(request,transport.peerAddress));}
      if(path.startsWith('/internal/')){
        if(path==='/internal/garmin/events'||path==='/internal/garmin/process')ensureProvider();else if(!provider)fail(503,'PROVIDER_CONFIGURATION_PENDING');
        if(origin||!relayHttpKey)fail(403,'ACCESS_DENIED');
        const timestamp=request.headers.get('x-trainoracle-relay-timestamp');if(!/^\d{10,13}$/.test(timestamp??'')||Math.abs(now()-Number(timestamp))>60_000)fail(403,'ACCESS_DENIED');
        const input=await boundedJson(request,6_500_000);
        if(!sameSignature(request.headers.get('x-trainoracle-relay-signature'),sign(relayHttpKey,`${timestamp}\n${path}\n${canonical(input)}`)))fail(403,'ACCESS_DENIED');
        if(path==='/internal/garmin/process'){if(!exact(input,[])||!push)fail(422,'INVALID_INPUT');return respond(200,await push.processOne());}
        if(path==='/internal/garmin/events'&&provider.kind==='GARMIN_STARTER')fail(422,'UNSUPPORTED_GARMIN_FEED');
        if(path==='/internal/garmin/revocations'){
          if(!exact(input,[]))fail(422,'INVALID_INPUT');const rows=(await repository.relay({action:'revocations',configHash})).rows;let completed=0;
          for(const row of rows){if(row.config_hash!==configHash)continue;const credentials=await vault.open(row.credential,credentialsContext(row.user_id,row.connection_id,row.epoch));if(!row.lease_id||Date.parse(row.lease_until)-now()<20000)continue;try{if(await provider.revoke(credentials)){await repository.relay({action:'revoked',configHash,id:row.id,lease:row.lease_id});completed++;}}catch{/* Keep encrypted outbox for a later explicitly scheduled retry; no plaintext log. */}}
          return respond(200,{completed,pending:rows.length-completed});
        }
        if(!exact(input,['eventId','connectionId','epoch','subject','activityId','revision','kind','observation','detail'])||!ID.test(input.eventId)||!UUID.test(input.connectionId)||!UUID.test(input.epoch)||!ID.test(input.subject)||!ID.test(input.activityId)||!positive(input.revision)||!['UPSERT','DELETE'].includes(input.kind))fail(422,'INVALID_INPUT');
        if(input.kind==='DELETE'&&(input.observation!==null||input.detail!==null))fail(422,'INVALID_INPUT');
        const observation=input.kind==='DELETE'?null:prepareObservation(input.observation);
        if(observation&&observation.sourceId!==input.activityId)fail(422,'INVALID_OBSERVATION');
        const parts=prepareDetail(input.detail,provider.allowedDetailFields);
        const resolved=await repository.relay({action:'resolve',configHash,connectionId:input.connectionId,epoch:input.epoch,subjectHash:subjectHash(input.subject)});
        const activityHash=sign(identityKey,`garmin-activity-v1:${input.subject}:${input.activityId}`);
        const inboxId=stableUuid(['trainoracle.garmin.inbox.v1',input.connectionId,input.epoch,activityHash]);
        const row={user_id:resolved.ownerId,connection_id:input.connectionId,epoch:input.epoch,inbox_id:inboxId,source_revision:input.revision};
        const detailManifest=parts.map((p,index)=>({partIndex:index,sha256:sha(canonical(p)),sampleCount:p.length}));
        const encryptedParts=await Promise.all(parts.map((p,index)=>vault.seal(p,context(resolved.ownerId,input.connectionId,input.epoch,'detail',`${inboxId}:${input.revision}:${index}`))));
        const result=await repository.relay({action:'ingest',configHash,ownerId:resolved.ownerId,connectionId:input.connectionId,epoch:input.epoch,subjectHash:subjectHash(input.subject),activityHash,inboxId,
          eventHash:sha(input.eventId),payloadDigest:sha(canonical(input)),contentDigest:sha(canonical({kind:input.kind,observation,detailManifest})),sourceRevision:input.revision,kind:input.kind,
          encryptedObservation:observation?await vault.seal(observation,rowContext(row)):null,detailManifest,encryptedParts});
        return respond(200,result);
      }
      const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer ')||authorization.length>16384)fail(401,'AUTH_REQUIRED');
      const revision=request.headers.get('x-trainoracle-storage-revision');const consentRevision=/^[1-9][0-9]{0,15}$/.test(revision??'')?Number(revision):null;
      const auth=await repository.authenticate(authorization.slice(7),consentRevision);const input=validateInput(await boundedJson(request,16_000));
      const call=data=>repository.call(auth,{configHash,...data});
      if(input.action==='status'){
        const status=await call({action:'status'});const current=enabled&&!!provider&&provider.isCurrent();return respond(200,{capability:{enabled:current&&status.ready,reason:!current?'PROVIDER_CONFIGURATION_PENDING':status.ready?'READY':'OPERATIONS_PENDING'},connection:connection(status.connection),pendingCount:status.pendingCount});
      }
      if(input.action==='disconnect') {
        const result=await call({action:'disconnect'});const revoked=result.revocation;
        if(revoked&&provider&&revoked.config_hash===configHash){try{const credentials=await vault.open(revoked.credential,credentialsContext(auth.ownerId,revoked.connection_id,revoked.epoch));if(revoked.lease_id&&Date.parse(revoked.lease_until)-now()>=20000&&await provider.revoke(credentials))await call({action:'ackRevocation',id:revoked.id,lease:revoked.lease_id});}catch{/* Local disconnection is durable; remote failure remains explicit. */}}
        const pending=await call({action:'revocationStatus'});const status=await call({action:'status'});return respond(200,{connection:connection(status.connection),remoteRevocationPending:pending.pending});
      }
      ensureProvider();
      if(input.action==='connect') {
        const state=nonce(),verifier=nonce(),connectionId=randomUUID(),epoch=randomUUID();
        await call({action:'begin',stateHash:sha(state),connectionId,epoch,encryptedVerifier:await vault.seal({verifier},context(auth.ownerId,connectionId,epoch,'pkce',sha(state)))});
        const challenge=createHash('sha256').update(verifier).digest('base64url');return respond(200,{authorizationUrl:provider.authorizationUrl(state,challenge),state,expiresAt:new Date(now()+600000).toISOString()});
      }
      if(input.action==='complete') {
        const attempt=await call({action:'consume',stateHash:sha(input.state)});
        if(attempt.kind!=='already_connected'){
          const {verifier}=await vault.open(attempt.encryptedVerifier,context(auth.ownerId,attempt.connectionId,attempt.epoch,'pkce',sha(input.state)));
          const credentials=await provider.exchange(input.code,verifier);
          try{const subject=await provider.subject(credentials);credentials.permissions=await provider.permissions(credentials);if(!credentials.permissions.includes('ACTIVITY_EXPORT'))fail(409,'PROVIDER_PERMISSION_REQUIRED');
            await call({action:'complete',stateHash:sha(input.state),subjectHash:subjectHash(subject),permissions:credentials.permissions,credential:await vault.seal(credentials,credentialsContext(auth.ownerId,attempt.connectionId,attempt.epoch))});}
          catch(error){try{await provider.revoke(credentials);}catch{}throw error;}
        }
        return respond(200,{connection:connection((await call({action:'status'})).connection)});
      }
      if(input.action==='refresh') {
        const lease=randomUUID();const row=await call({action:'leaseRefresh',lease});
        const credentials=await vault.open(row.credential,credentialsContext(auth.ownerId,row.connectionId,row.epoch));
        let next;try{next=await provider.refresh(credentials);next.permissions=await provider.permissions(next);if(!next.permissions.includes('ACTIVITY_EXPORT'))fail(409,'PROVIDER_PERMISSION_REQUIRED');}
        catch(error){try{await call({action:'failRefresh',lease,epoch:row.epoch,credentialRevision:row.credentialRevision,
          ...(next?{credential:await vault.seal(next,credentialsContext(auth.ownerId,row.connectionId,row.epoch))}:{})});}
          catch{if(next){try{await provider.revoke(next);}catch{}}}throw error;}
        await call({action:'finishRefresh',lease,epoch:row.epoch,credentialRevision:row.credentialRevision,permissions:next.permissions,credential:await vault.seal(next,credentialsContext(auth.ownerId,row.connectionId,row.epoch))});
        return respond(200,{connection:connection((await call({action:'status'})).connection)});
      }
      if(input.action==='inbox'){const rows=(await call(input)).rows;const selected=rows.slice(0,20);const items=await Promise.all(selected.map(item));if(selected.length)await call({action:'verify',epoch:selected[0].epoch});return respond(200,{items,nextCursor:rows.length>20?selected.at(-1).inbox_id:null});}
      if(input.action==='read'){const row=(await call(input)).row;const decoded=await item(row);await call({action:'verify',epoch:row.epoch});return respond(200,{item:decoded});}
      if(input.action==='detail'){
        const result=await call(input);const manifest=result.row.detail_manifest.find(p=>p.partIndex===input.partIndex);if(!manifest||!result.part)fail(404,'DETAIL_UNAVAILABLE');
        const samples=await vault.open(result.part,context(auth.ownerId,result.row.connection_id,result.row.epoch,'detail',`${result.row.inbox_id}:${result.row.source_revision}:${input.partIndex}`));if(sha(canonical(samples))!==manifest.sha256)fail(503,'ENCRYPTED_DATA_UNAVAILABLE');
        await call({action:'verify',epoch:result.row.epoch});
        return respond(200,{inboxId:input.inboxId,revision:input.expectedRevision,...manifest,samples});
      }
      if(input.action==='dismiss')return respond(200,await call(input));
      if(input.action==='confirm'){
        if(!journalKeyring||!journalAttest)fail(503,'JOURNAL_CONTRACT_UNAVAILABLE');
        const row=(await call({action:'read',inboxId:input.inboxId})).row;if(row.source_revision!==input.expectedRevision)fail(409,'SOURCE_CHANGED');
        if(['CONFLICT','DELETED','DISMISSED'].includes(row.state))fail(409,'REVIEW_REQUIRED');
        const observation=await decode(row);if(!observation)fail(409,'SOURCE_CHANGED');
        const proposal=providerJournalDocument(auth,row,observation,(await sourceContext(row))?.clock);
        const encryptedPayload=await encryptAccountJournalDocument(canonical(proposal.document),{ownerId:auth.ownerId,documentId:proposal.documentId},journalKeyring.active);
        const journalProof=await journalAttest(auth.ownerId,'commit',{documentId:proposal.documentId,operationId:input.operationId,expectedRevision:0,encryptedPayload,metadata:{...accountJournalMetadata(proposal.document),awardAllowed:false}});
        const result=await call({...input,documentId:proposal.documentId,journalEntryId:proposal.journalEntryId,journalProof});
        return respond(200,{kind:result.kind,documentId:result.receipt.documentId,journalEntryId:result.journalEntryId,revision:result.receipt.revision,date:proposal.document.entry.date});
      }
      fail(422,'INVALID_INPUT');
    }catch(error){return respond(error instanceof IntegrationError?error.status:503,{error:error instanceof IntegrationError?error.code:'OPERATIONS_PENDING'});}
  };
}

export function createNodeServer(handler){const server=createServer(async(req,res)=>{try{const request=new Request(`http://localhost${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});const result=await handler(request,{peerAddress:req.socket.remoteAddress});res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch{res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"OPERATIONS_PENDING"}');}});server.requestTimeout=25000;server.headersTimeout=10000;server.maxHeadersCount=40;return server;}
export async function runtimeFromEnvironment(env=process.env){
  const enabled=env.TRAINORACLE_GARMIN_ENABLED==='true';let repository,vault,provider,journalKeyring,journalAttest,identityKey,relayHttpKey;
  if(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY&&env.TRAINORACLE_GARMIN_ATTESTATION_JSON&&env.TRAINORACLE_GARMIN_VAULT_JSON){
    repository=createSupabaseRepository({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_ANON_KEY,attestation:JSON.parse(env.TRAINORACLE_GARMIN_ATTESTATION_JSON),relayAttestation:env.TRAINORACLE_GARMIN_RELAY_ATTESTATION_JSON?JSON.parse(env.TRAINORACLE_GARMIN_RELAY_ATTESTATION_JSON):undefined,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
    vault=await createVault(JSON.parse(env.TRAINORACLE_GARMIN_VAULT_JSON));identityKey=keyBytes(env.TRAINORACLE_GARMIN_IDENTITY_KEY);relayHttpKey=env.TRAINORACLE_GARMIN_RELAY_HTTP_KEY?keyBytes(env.TRAINORACLE_GARMIN_RELAY_HTTP_KEY):undefined;
  }
  // An expired or incomplete vendor profile closes import, but must not make
  // already-authenticated status/local disconnect inaccessible after a restart.
  if(env.TRAINORACLE_GARMIN_REVIEWED_PROFILE_JSON){try{const profile=JSON.parse(env.TRAINORACLE_GARMIN_REVIEWED_PROFILE_JSON);provider=profile.accessLevel==='STARTER'?createGarminStarterProvider(profile):undefined;}catch{provider=undefined;}}
  if(env.TRAINORACLE_JOURNAL_KEYRING_JSON&&env.TRAINORACLE_JOURNAL_ATTESTATION_JSON){journalKeyring=await importJournalKeyring(env.TRAINORACLE_JOURNAL_KEYRING_JSON);journalAttest=await importJournalAttestor(env.TRAINORACLE_JOURNAL_ATTESTATION_JSON);}
  const push=repository&&provider?.kind==='GARMIN_STARTER'?createGarminPushRuntime({repository,vault,provider,identityKey,enabled:enabled&&env.TRAINORACLE_GARMIN_PUSH_ENABLED==='true',trustedProxyAddresses:(env.TRAINORACLE_GARMIN_TRUSTED_PROXY_ADDRESSES??'').split(',').filter(Boolean)}):undefined;
  return {handler:createGarminHandler({repository,vault,provider,identityKey,relayHttpKey,journalKeyring,journalAttest,push,enabled,allowedOrigins:(env.TRAINORACLE_GARMIN_ALLOWED_ORIGINS??'').split(',').map(s=>s.trim()).filter(Boolean)}),
    configured:!!(repository&&vault&&provider?.isCurrent()&&identityKey&&relayHttpKey&&journalKeyring&&journalAttest&&env.TRAINORACLE_GARMIN_RELAY_ATTESTATION_JSON&&env.SUPABASE_SERVICE_ROLE_KEY)};
}
export async function serviceFromEnvironment(env=process.env){return createNodeServer((await runtimeFromEnvironment(env)).handler);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const server=await serviceFromEnvironment();const port=Number(process.env.PORT??8789);if(!Number.isInteger(port)||port<1||port>65535)throw 0;server.listen(port,'127.0.0.1');}catch{process.stderr.write('GARMIN_INTEGRATION_CONFIGURATION_INVALID\n');process.exitCode=1;}}
