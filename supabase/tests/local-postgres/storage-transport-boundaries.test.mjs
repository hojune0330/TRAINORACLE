import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAccountJournalHandler } from '../../functions/_shared/account-journal-handler.mjs';
import { createAccountPlanCollectionHandler } from '../../functions/_shared/account-plan-collection-handler.mjs';
import { prepareCorosWorkoutStorage as prepareNormal, corosWorkoutConnectionResolver } from '../../functions/_shared/coros-workout-storage.mjs';
const origin='https://synthetic.example.test';
let journalFactory=createAccountJournalHandler,planFactory=createAccountPlanCollectionHandler,prepareCorosWorkoutStorage=prepareNormal;
if(process.env.STORAGE_TRANSPORT_MUTATION) {
  const mutation=process.env.STORAGE_TRANSPORT_MUTATION;
  const filename=mutation==='journal-cors'?'account-journal-handler.mjs':mutation==='plan-cors'?'account-plan-collection-handler.mjs':'coros-workout-storage.mjs';
  const url=new URL(`../../functions/_shared/${filename}`,import.meta.url);
  let source=await readFile(url,'utf8');
  const target=mutation==='workout-rebind'?'connectionEpoch: link.connection_epoch':", 'x-trainoracle-storage-revision'].includes";
  assert.ok(source.includes(target),'observed mutation target required');
  source=source.replace(target,mutation==='workout-rebind'?'get connectionEpoch() { return link.connection_epoch }':'].includes');
  source=source.replace(/(['"])(\.\/[^'"]+)\1/gu,(_all,_quote,path)=>JSON.stringify(new URL(path,url).href));
  const broken=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  if(mutation==='journal-cors') journalFactory=broken.createAccountJournalHandler;
  else if(mutation==='plan-cors') planFactory=broken.createAccountPlanCollectionHandler;
  else prepareCorosWorkoutStorage=broken.prepareCorosWorkoutStorage;
}
for(const [name,factory] of [['journal',journalFactory],['plan collection',planFactory]]) {
  test(`${name} preflight accepts the pinned revision header and rejects unknown headers before auth`,async()=>{
    const forbidden=()=>{throw new Error('preflight must not access account material');};
    const handler=factory({authenticate:forbidden,getMaterial:forbidden,allowedOrigins:[origin]});
    const request=extra=>new Request(`${origin}/synthetic`,{method:'OPTIONS',headers:{origin,
      'access-control-request-method':'POST','access-control-request-headers':`authorization,content-type,x-trainoracle-storage-revision${extra}`}});
    const allowed=await handler(request(''));assert.equal(allowed.status,204);
    assert.ok(allowed.headers.get('access-control-allow-headers').includes('x-trainoracle-storage-revision'));
    assert.equal((await handler(request(',x-forged-privilege'))).status,403);
  });
}
const connection={id:'a1111111-1111-4111-8111-111111111111',user_id:'b2222222-2222-4222-8222-222222222222',
  connection_epoch:'c3333333-3333-4333-8333-333333333333',connection_status:'ACTIVE'};
test('workout digest work never silently upgrades the initially observed connection generation',async()=>{
  const original=connection.connection_epoch;let calls=0;
  const item={providerUserId:'synthetic',providerRecordId:'synthetic'};
  const result=await prepareCorosWorkoutStorage([item],async()=>{calls++;return connection;},async items=>{
    connection.connection_epoch='d4444444-4444-4444-8444-444444444444';return items.map(i=>({...i,payloadDigest:'a'.repeat(64)}));
  });
  assert.equal(calls,1);assert.equal(result[0].connectionEpoch,original);assert.equal(result[0].ownerId,connection.user_id);
  await assert.rejects(prepareCorosWorkoutStorage([item],async()=>null),/CONNECTION_UNAVAILABLE/);
});
test('workout connection resolution accepts exactly one active link and disables cache and redirects',async()=>{
  let options;let endpoint;
  const resolve=corosWorkoutConnectionResolver('https://synthetic-db.example.test','synthetic-key',async(url,init)=>{
    endpoint=url;options=init;return new Response(JSON.stringify([connection]),{status:200});
  });
  assert.deepEqual(await resolve('synthetic'),connection);assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
  assert.equal(endpoint.searchParams.get('provider_user_id'),'eq.synthetic');assert.equal(endpoint.searchParams.get('connection_status'),'eq.ACTIVE');
  assert.equal(await corosWorkoutConnectionResolver('https://synthetic-db.example.test','synthetic-key',async()=>new Response('[]'))('synthetic'),null);
});
