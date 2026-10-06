import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoungeDeletionHandler, createLoungeDeletionRepository, createLoungeDeletionWorker, deletionEndpoint, DELETION_TIMEOUT_MS, DELETION_BATCH_SIZE } from '../functions/_shared/lounge-identity-deletion-worker.mjs';

const endpoint='https://runtime.example/api/lounge/internal/identity-deletion';
const deletionKey='a'.repeat(64),invokeKey='b'.repeat(64);
const row={version:1,requestId:'a1111111-1111-4111-8111-111111111111',subject:'b2222222-2222-4222-8222-222222222222',leaseId:'c3333333-3333-4333-8333-333333333333'};
const ack=()=>new Response(JSON.stringify({version:1,requestId:row.requestId,status:'completed'}));
function fixture() {
  const calls={complete:[],retry:[],claim:0};
  const repository={claim:async()=>{calls.claim++;return[row]},complete:async value=>{calls.complete.push(value);return true},retry:async value=>{calls.retry.push(value);return true}};
  return{calls,repository};
}

test('sends only minimum versioned deletion with dedicated key, then completes and returns counts only',async()=>{
  const {calls,repository}=fixture();let request;
  const worker=createLoungeDeletionWorker({repository,endpoint,deletionKey,fetchImpl:async(url,init)=>{request={url,init};return ack()}});
  assert.deepEqual(await worker(),{version:1,attempted:1,completed:1,pending:0});
  assert.equal(request.url,endpoint);assert.equal(request.init.credentials,'omit');assert.equal(request.init.redirect,'error');
  assert.equal(request.init.headers.Authorization,`Bearer ${deletionKey}`);
  assert.deepEqual(JSON.parse(request.init.body),{version:1,requestId:row.requestId,issuer:'trainoracle',subject:row.subject});
  assert.equal(calls.complete.length,1);assert.equal(calls.retry.length,0);
});

test('lost remote ACK retries the same request ID without dropping a possibly committed deletion',async()=>{
  const {calls,repository}=fixture();const remote=[];let lost=true;
  const worker=createLoungeDeletionWorker({repository,endpoint,deletionKey,fetchImpl:async(_url,init)=>{
    remote.push(JSON.parse(init.body));if(lost){lost=false;throw Error('synthetic ACK lost after COMMIT')}return ack();
  }});
  assert.equal((await worker()).pending,1);assert.equal(calls.complete.length,0);assert.equal(calls.retry.length,1);
  assert.equal((await worker()).completed,1);assert.equal(remote[0].requestId,remote[1].requestId);
});

for(const kind of ['wrong-id','extra-field','invalid-json','503','failed-local-ack'])test(`keeps row pending on ${kind} rather than claiming success`,async()=>{
  const {calls,repository}=fixture();if(kind==='failed-local-ack')repository.complete=async()=>false;
  const fetchImpl=async()=>kind==='503'?new Response('{}',{status:503}):kind==='invalid-json'?new Response('{'):
    kind==='wrong-id'?new Response(JSON.stringify({version:1,requestId:row.subject,status:'completed'})):
    kind==='extra-field'?new Response(JSON.stringify({version:1,requestId:row.requestId,status:'completed',subject:row.subject})):ack();
  const worker=createLoungeDeletionWorker({repository,endpoint,deletionKey,fetchImpl});
  assert.deepEqual(await worker(),{version:1,attempted:1,completed:0,pending:1});assert.equal(calls.retry.length,1);
});

test('retry RPC failure preserves the lease and exposes no raw exception or identifier',async()=>{
  const {repository}=fixture();repository.retry=async()=>{throw Error(row.subject)};
  const result=await createLoungeDeletionWorker({repository,endpoint,deletionKey,fetchImpl:async()=>{throw Error(deletionKey)}})();
  assert.deepEqual(result,{version:1,attempted:1,completed:0,pending:1});assert.ok(!JSON.stringify(result).includes(row.subject));
});

test('malformed queue rows fail closed before any remote request',async()=>{
  for(const bad of [{...row,body:'synthetic forbidden text'}, {...row,subject:'bad'}, {...row,version:2},null]){
    let sent=0;const {repository}=fixture();repository.claim=async()=>[bad];
    await assert.rejects(createLoungeDeletionWorker({repository,endpoint,deletionKey,fetchImpl:async()=>{sent++;return ack()}})(),/DELETION_UNAVAILABLE/u);
    assert.equal(sent,0);
  }
});

test('oversized queue batch fails closed before remote send or local completion',async()=>{
  const {repository,calls}=fixture();let sent=0;
  // Four is deliberately not derived from the configured size: a limit10
  // regression must fail this test instead of moving the expectation with it.
  repository.claim=async()=>Array.from({length:4},()=>({...row}));
  await assert.rejects(createLoungeDeletionWorker({repository,endpoint,deletionKey,fetchImpl:async()=>{sent++;return ack()}})(),/DELETION_UNAVAILABLE/u);
  assert.equal(sent,0);assert.equal(calls.complete.length,0);assert.equal(calls.retry.length,0);
});

test('sequential worst-case batch stays within the free worker and SQL lease bounds',()=>{
  assert.equal(DELETION_BATCH_SIZE,3);
  const worstCaseMs=DELETION_TIMEOUT_MS + DELETION_BATCH_SIZE * 3 * DELETION_TIMEOUT_MS;
  assert.equal(worstCaseMs,80_000);
  assert.ok(worstCaseMs < 120_000,'must finish before SQL lease expires');
  assert.ok(worstCaseMs < 150_000,'must fit Supabase free wall-clock limit');
});

test('timeouts abort remote work and release for retry without completing',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {calls,repository}=fixture();let signal,enteredResolve;
  const entered=new Promise(resolve=>{enteredResolve=resolve});
  const pending=createLoungeDeletionWorker({repository,endpoint,deletionKey,fetchImpl:async(_url,init)=>{signal=init.signal;enteredResolve();return new Promise(()=>{})}})();
  await entered;t.mock.timers.tick(DELETION_TIMEOUT_MS);
  assert.deepEqual(await pending,{version:1,attempted:1,completed:0,pending:1});
  assert.equal(signal.aborted,true);assert.equal(calls.complete.length,0);assert.equal(calls.retry.length,1);
});

test('empty queue is a successful zero-count run without a remote call',async()=>{
  const {repository}=fixture();repository.claim=async()=>[];
  assert.deepEqual(await createLoungeDeletionWorker({repository,endpoint,deletionKey,fetchImpl:async()=>{throw Error('Must not call')}})(),{version:1,attempted:0,completed:0,pending:0});
});

test('repository uses only three scoped RPCs and abort signals, never account/journal table APIs',async()=>{
  const calls=[];const client={rpc:(name,input)=>({abortSignal:async signal=>{calls.push({name,input,signal});return{data:name==='claim_lounge_identity_deletions'?[row]:true,error:null}}})};
  const repo=createLoungeDeletionRepository(client);const signal=new AbortController().signal;
  assert.deepEqual(await repo.claim(signal),[row]);assert.equal(await repo.complete(row,signal),true);assert.equal(await repo.retry(row,signal),true);
  assert.deepEqual(calls.map(value=>value.name),['claim_lounge_identity_deletions','complete_lounge_identity_deletion','retry_lounge_identity_deletion']);
  assert.deepEqual(calls[0].input,{limit_input:3});
  assert.ok(calls.every(value=>value.signal===signal));
});

test('private handler denies browser Origin and ordinary credentials; validates explicit empty-body POST',async()=>{
  let runs=0;const handler=createLoungeDeletionHandler({invokeKey,worker:async()=>{runs++;return{version:1,attempted:0,completed:0,pending:0}}});
  for(const headers of [{},{authorization:'Bearer synthetic-user-jwt'},{authorization:`Bearer ${deletionKey}`},{authorization:`Bearer ${invokeKey}`,origin:'https://trainoracle.example'}]){
    assert.equal((await handler(new Request('https://worker.example',{method:'POST',headers,body:'{}'}))).status,403);
  }
  assert.equal(runs,0);
  assert.equal((await handler(new Request('https://worker.example',{method:'GET',headers:{authorization:`Bearer ${invokeKey}`}}))).status,405);
  assert.equal((await handler(new Request('https://worker.example',{method:'POST',headers:{authorization:`Bearer ${invokeKey}`},body:'{"subject":"bad"}'}))).status,400);
  const result=await handler(new Request('https://worker.example',{method:'POST',headers:{authorization:`Bearer ${invokeKey}`},body:'{}'}));
  assert.equal(result.status,200);assert.equal(result.headers.get('access-control-allow-origin'),null);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(runs,1);
});

test('rejects non-HTTPS, local/IP, redirected, credential/query-bearing and wrong-path endpoints',()=>{
  assert.equal(deletionEndpoint(endpoint),endpoint);
  for(const unsafe of ['http://runtime.example/api/lounge/internal/identity-deletion','https://127.0.0.1/api/lounge/internal/identity-deletion',
    'https://localhost/api/lounge/internal/identity-deletion','https://[::1]/api/lounge/internal/identity-deletion',endpoint+'?token=x',endpoint+'#x',
    'https://user:secret@runtime.example/api/lounge/internal/identity-deletion','https://runtime.example/api/lounge/status']){
    assert.equal(deletionEndpoint(unsafe),null);
  }
  assert.throws(()=>createLoungeDeletionWorker({repository:{},endpoint,deletionKey:'synthetic JWT'}),/CONFIGURATION_UNAVAILABLE/u);
});
