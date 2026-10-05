import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAccountDataRightsHandler} from '../functions/_shared/account-data-rights-handler.mjs';
import {encryptAccountJournalDocument} from '../functions/_shared/account-journal-crypto.mjs';
const A='a1111111-1111-4111-8111-111111111111',B='b2222222-2222-4222-8222-222222222222';
const D='d4444444-4444-4444-8444-444444444444',ORIGIN='https://synthetic.example';
const request=(input={},origin=ORIGIN)=>new Request('https://synthetic.example/functions/v1/account-data-rights',{
  method:'POST',headers:{Origin:origin,Authorization:'Bearer synthetic-token','Content-Type':'application/json'},
  body:JSON.stringify({expectedUserId:A,expectedSessionId:A,collection:'journal',cursor:'',...input}),
});
const material={keyId:'synthetic',key:await crypto.subtle.importKey('raw',new Uint8Array(32).fill(17),'AES-GCM',false,['encrypt','decrypt'])};
const envelope=await encryptAccountJournalDocument(JSON.stringify({note:'synthetic private text'}),{ownerId:A,documentId:D},material);
function handler({rowOwner=A,verify=true,read=()=>({ownerId:A,collection:'journal',items:[{cursor:D,record:{user_id:rowOwner,document_id:D,encrypted_payload:envelope}}],nextCursor:null})}={}) {
  return createAccountDataRightsHandler({allowedOrigins:[ORIGIN],getMaterial:async()=>({get:()=>material}),
    authenticate:async()=>({ownerId:A,read,verify:async()=>verify})});
}
test('explicit owner export decrypts existing data and is no-store without enabling any writer',async()=>{
  const response=await handler()(request());
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const page=await response.json();assert.equal(page.items[0].record.document.note,'synthetic private text');
  assert.equal(page.items[0].record.encrypted_payload,undefined);
});
test('wrong owner, cross-account rows, revoked session and foreign origin return no private data',async()=>{
  for(const [run,req] of [[handler(),request({expectedUserId:B})],[handler({rowOwner:B}),request()],
    [handler({verify:false}),request()],[handler(),request({},'https://foreign.example')]]) {
    const response=await run(req);assert.ok(response.status>=400);
    assert.equal((await response.text()).includes('synthetic private text'),false);
  }
});
test('save/restore content is rejected before reading and oversized body is bounded',async()=>{
  let called=false;const run=handler({read:()=>{called=true;throw Error('unexpected')}});
  assert.equal((await run(request({action:'restore',document:{health:'synthetic'}}))).status,400);
  assert.equal((await run(request({cursor:'x'.repeat(5000)}))).status,413);
  assert.equal(called,false);
});
