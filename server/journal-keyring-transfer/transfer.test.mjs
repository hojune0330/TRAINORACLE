import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createNodeServer} from '../garmin-integration/service.mjs';
import {importJournalKeyring} from '../../supabase/functions/_shared/account-journal-handler.mjs';
import {encryptAccountJournalDocument,decryptAccountJournalDocument} from '../../supabase/functions/_shared/account-journal-crypto.mjs';
import {VERSION,SECRET_NAME,MAX_KEYRING_BYTES,MAX_ENVELOPE_BYTES,base64,sha256,validatePins,validateKeyring,sealKeyring,openPinnedEnvelope} from './protocol.mjs';
import {createSealedExportHandler} from './export-handler.mjs';
import {environmentWithSealedKeyring,startSealedGarminDeployment} from './bootstrap.mjs';

// Synthetic material only. No environment secrets, DB, hosted Edge or Render calls.
const at=Date.parse('2026-11-05T00:00:00Z')/1000,token='S'.repeat(43);
const rawKeyring=JSON.stringify({activeKeyId:'synthetic-current',keys:{'synthetic-old':Buffer.alloc(32,51).toString('base64'),'synthetic-current':Buffer.alloc(32,52).toString('base64')}},null,2)+'\n';
let keys,spki,pkcs8,pins,config;
before(async()=>{
  keys=await crypto.subtle.generateKey({name:'RSA-OAEP',hash:'SHA-256',modulusLength:3072,publicExponent:new Uint8Array([1,0,1])},true,['encrypt','decrypt']);
  spki=base64(await crypto.subtle.exportKey('spki',keys.publicKey));pkcs8=base64(await crypto.subtle.exportKey('pkcs8',keys.privateKey));
  pins={schemaVersion:VERSION,secretName:SECRET_NAME,sourceProjectRef:'abcdefghijklmnopqrst',destinationServiceId:'srv-syntheticdestination',migrationId:randomUUID(),validFrom:at-30,expiresAt:at+600,
    recipientSha256:await sha256(Buffer.from(spki,'base64')),keyringSha256:await sha256(rawKeyring)};
  config={mode:'SEALED_EXPORT',pins,recipientSpkiBase64:spki,authorizationSha256:await sha256(token)};
});
const request=(patch={})=>new Request('https://source.example.test/functions/v1/journal-keyring-sealed-migration',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...patch.headers},body:patch.body??'{}'});
const envelope=()=>sealKeyring(rawKeyring,pins,spki,at);
const nodeEnv=async raw=>({PORT:'0',SUPABASE_URL:`https://${pins.sourceProjectRef}.supabase.co`,RENDER_SERVICE_ID:pins.destinationServiceId,
  TRAINORACLE_JOURNAL_SEALED_ENABLED:'true',TRAINORACLE_JOURNAL_SEALED_CONFIG_JSON:JSON.stringify({pins,envelopeSha256:await sha256(raw)}),
  TRAINORACLE_JOURNAL_SEALED_ENVELOPE_JSON:raw,TRAINORACLE_JOURNAL_RECIPIENT_PKCS8_BASE64:pkcs8,
  TRAINORACLE_JOURNAL_ATTESTATION_JSON:JSON.stringify({keyId:'synthetic-node-only',key:Buffer.alloc(32,53).toString('base64')})});
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});

test('actual local HTTP exports ciphertext only; pinned bootstrap preserves exact historical keyring and existing ciphertext',async()=>{
  let reads=0;const handler=createSealedExportHandler({config,now:()=>at*1000,readKeyring:name=>{assert.equal(name,SECRET_NAME);reads++;return rawKeyring;}});
  const server=createNodeServer(handler),port=await new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
  try{
    const response=await fetch(`http://127.0.0.1:${port}/functions/v1/journal-keyring-sealed-migration`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:'{}'});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const serialized=await response.text();assert.equal(reads,1);
    assert.ok(!serialized.includes('synthetic-old'));assert.ok(!serialized.includes(Buffer.alloc(32,51).toString('base64')));assert.ok(!serialized.includes(pkcs8));
    const env=await nodeEnv(serialized),loaded=await environmentWithSealedKeyring(env);assert.equal(loaded[SECRET_NAME],rawKeyring);
    assert.equal(loaded.TRAINORACLE_JOURNAL_RECIPIENT_PKCS8_BASE64,undefined);assert.equal(env[SECRET_NAME],undefined);
    const before=await importJournalKeyring(rawKeyring),after=await importJournalKeyring(loaded[SECRET_NAME]);
    const context={ownerId:randomUUID(),documentId:randomUUID()},payload=await encryptAccountJournalDocument('{"synthetic":true}',context,before.get('synthetic-old'));
    assert.equal(await decryptAccountJournalDocument(payload,context,after.get(payload.keyId)),'{"synthetic":true}');
    assert.equal(after.active.keyId,'synthetic-current');
  }finally{await close(server);}
});

test('unauthorized, browser, changed body and expired requests never read the existing keyring',async()=>{
  let reads=0;const handler=createSealedExportHandler({config,now:()=>at*1000,readKeyring:()=>{reads++;return rawKeyring;}});
  for(const bad of [request({headers:{authorization:'Bearer invalid'}}),request({headers:{origin:'https://evil.test'}}),request({headers:{cookie:'x=y'}}),request({body:'{"recipient":"evil"}'}),request({body:'[]'}),
    new Request('https://source.test/functions/v1/journal-keyring-sealed-migration?secret=OTHER',{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'})]){
    assert.notEqual((await handler(bad)).status,200);
  }
  const expired=createSealedExportHandler({config,now:()=>pins.expiresAt*1000,readKeyring:()=>{reads++;return rawKeyring;}});
  assert.equal((await expired(request())).status,503);assert.equal(reads,0);
});

test('fingerprint preflight reveals only exact raw SHA-256 and enforces the same authentication and expiry before reading',async()=>{
  const fingerprintConfig={...config,mode:'FINGERPRINT_ONLY',pins:{...pins,keyringSha256:null}};let reads=0;
  const readKeyring=()=>{reads++;return rawKeyring;},handler=createSealedExportHandler({config:fingerprintConfig,now:()=>at*1000,readKeyring});
  assert.equal((await handler(request({headers:{authorization:'Bearer invalid'}}))).status,403);assert.equal(reads,0);
  const expired=createSealedExportHandler({config:fingerprintConfig,now:()=>pins.expiresAt*1000,readKeyring});
  assert.equal((await expired(request())).status,503);assert.equal(reads,0);
  const response=await handler(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{schemaVersion:'TRAINORACLE_JOURNAL_FINGERPRINT_V1',rawSha256:await sha256(rawKeyring)});assert.equal(reads,1);
  assert.throws(()=>createSealedExportHandler({config:{...fingerprintConfig,pins:{...pins}},readKeyring}));
});

test('every metadata pin, envelope bytes, wrapped key, AES ciphertext and private recipient are verified',async()=>{
  const good=await envelope(),serialized=JSON.stringify(good),hash=await sha256(serialized);
  for(const field of ['sourceProjectRef','destinationServiceId','migrationId','recipientSha256','keyringSha256','validFrom','expiresAt','secretName','schemaVersion']){
    const changed=structuredClone(good);changed.metadata[field]=typeof changed.metadata[field]==='number'?changed.metadata[field]+1:'changed';const raw=JSON.stringify(changed);
    await assert.rejects(openPinnedEnvelope(raw,pins,await sha256(raw),pkcs8),/JOURNAL_SEALED_MIGRATION_INVALID/);
  }
  for(const field of ['wrappedKey','iv','ciphertext']){const changed={...good,[field]:(good[field][0]==='A'?'B':'A')+good[field].slice(1)},raw=JSON.stringify(changed);await assert.rejects(openPinnedEnvelope(raw,pins,await sha256(raw),pkcs8));}
  await assert.rejects(openPinnedEnvelope(serialized+' ',pins,hash,pkcs8));
  const wrong=await crypto.subtle.generateKey({name:'RSA-OAEP',hash:'SHA-256',modulusLength:3072,publicExponent:new Uint8Array([1,0,1])},true,['encrypt','decrypt']);
  await assert.rejects(openPinnedEnvelope(serialized,pins,hash,base64(await crypto.subtle.exportKey('pkcs8',wrong.privateKey))));
});

test('plaintext digest is checked before reserialization; source schema, recipient, window and size cannot expand',async()=>{
  assert.equal(validateKeyring(rawKeyring),rawKeyring);
  await assert.rejects(sealKeyring(JSON.stringify(JSON.parse(rawKeyring)),pins,spki,at));
  for(const raw of ['{}','{"activeKeyId":"missing","keys":{}}',JSON.stringify({activeKeyId:'a',keys:{a:'invalid'}}),' '.repeat(MAX_KEYRING_BYTES+1)])assert.throws(()=>validateKeyring(raw));
  assert.throws(()=>validatePins({...pins,expiresAt:pins.validFrom+901}));assert.throws(()=>validatePins({...pins,secretName:'SUPABASE_SERVICE_ROLE_KEY'}));
  await assert.rejects(sealKeyring(rawKeyring,{...pins,recipientSha256:'0'.repeat(64)},spki,at));
  await assert.rejects(sealKeyring(rawKeyring,pins,spki,pins.expiresAt));
  await assert.rejects(openPinnedEnvelope(' '.repeat(MAX_ENVELOPE_BYTES+1),pins,'0'.repeat(64),pkcs8));
});

test('original Edge entry only reads its fixed source after authorization and returns sanitized failures',async()=>{
  let handler;const reads=[],values={TRAINORACLE_JOURNAL_MIGRATION_EXPORT_CONFIG_JSON:JSON.stringify({...config,pins:{...pins,validFrom:Math.floor(Date.now()/1000)-1,expiresAt:Math.floor(Date.now()/1000)+60}}),SUPABASE_URL:`https://${pins.sourceProjectRef}.supabase.co`,[SECRET_NAME]:rawKeyring};
  globalThis.Deno={env:{get:name=>{reads.push(name);return values[name];}},serve:value=>{handler=value;}};
  try{
    await import('./edge-entry.mjs?synthetic-test');assert.ok(!reads.includes(SECRET_NAME));
    assert.equal((await handler(request({headers:{authorization:'no'}}))).status,403);assert.ok(!reads.includes(SECRET_NAME));
    assert.equal((await handler(request())).status,200);assert.equal(reads.filter(name=>name===SECRET_NAME).length,1);
    const stripped=new Request('https://source.test/journal-keyring-sealed-migration',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:'{}'});
    assert.equal((await handler(stripped)).status,200);assert.equal(reads.filter(name=>name===SECRET_NAME).length,2);
    assert.equal((await handler(new Request('https://source.test/untrusted/journal-keyring-sealed-migration',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:'{}'}))).status,403);
    assert.equal(reads.filter(name=>name===SECRET_NAME).length,2);
    values[SECRET_NAME]='PRIVATE_SYNTHETIC_ERROR_CANARY';const response=await handler(request());assert.equal(response.status,503);assert.equal(await response.text(),'{"error":"MIGRATION_UNAVAILABLE"}');
  }finally{delete globalThis.Deno;}
});

test('opt-in bootstrap does not change default deployment and rejects a different project, service or existing keyring',async()=>{
  const unchanged={PORT:'0'};assert.equal(await environmentWithSealedKeyring(unchanged),unchanged);
  const env=await nodeEnv(JSON.stringify(await envelope()));
  for(const patch of [{SUPABASE_URL:'https://other.example.test'},{RENDER_SERVICE_ID:'srv-otherdestination'},{[SECRET_NAME]:'DIFFERENT_EXISTING_KEYRING'}])await assert.rejects(environmentWithSealedKeyring({...env,...patch}));
  const messages=[];
  // Migration issuance is historical; the pinned artifact remains usable after
  // the export window ends, including two independent process starts.
  for(let i=0;i<2;i++){
    const deployed=await startSealedGarminDeployment({env,onEvent:value=>messages.push(value)});
    try{const response=await fetch(`http://127.0.0.1:${deployed.port}/healthz`),text=await response.text();assert.equal(response.status,200);assert.ok(!text.includes('synthetic-old'));assert.ok(!text.includes(pkcs8));}
    finally{await deployed.stop();}
  }
  assert.ok(!JSON.stringify(messages).includes(rawKeyring));assert.ok(!JSON.stringify(messages).includes(pkcs8));
});
