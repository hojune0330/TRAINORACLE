import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createGarminEdgeHandler,createTickClaim,CRON_PATH,CRON_HEADERS,cronSignatureText} from './edge-runtime.mjs';
import {createGarminRuntime} from './service.mjs';
import {INGRESS_HEADERS,INGRESS_VERSION,signatureText} from '../garmin-ingress/protocol.mjs';

const at=Date.parse('2026-11-05T00:00:00Z'),base='https://synthetic.supabase.co/functions/v1/garmin-integration';
const cronKey=Buffer.alloc(32,7);
const env={SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',
  TRAINORACLE_GARMIN_WORKER_ENABLED:'true',TRAINORACLE_GARMIN_CRON_KEY:cronKey.toString('base64'),TRAINORACLE_GARMIN_CRON_KEY_ID:'cron-v1',
  TRAINORACLE_GARMIN_INGRESS_MODE:'CLOUDFLARE_SIGNED_V1',TRAINORACLE_GARMIN_INGRESS_KEY_ID:'ingress-v1',TRAINORACLE_GARMIN_INGRESS_AUDIENCE:'synthetic-edge',TRAINORACLE_GARMIN_INGRESS_SECRET_HEX:'ab'.repeat(32)};
const hash=value=>createHash('sha256').update(value).digest('hex');
const request=(suffix='',body='{}',headers={})=>new Request(base+suffix,{method:'POST',headers:{'content-type':'application/json',...headers},body});
function tick({fields={},headers={},body='{}',suffix=CRON_PATH}={}){
  const value={keyId:'cron-v1',timestamp:String(at/1000),nonce:'01'.repeat(16),...fields};
  const signature=createHmac('sha256',cronKey).update(cronSignatureText(value)).digest('hex');
  return request(suffix,body,{authorization:`Bearer ${env.SUPABASE_ANON_KEY}`,...Object.fromEntries(Object.entries(CRON_HEADERS).map(([name,header])=>[header,name==='signature'?signature:value[name]])),...headers});
}
function ingress({body='{"activities":[]}',headers={},nonce='02'.repeat(16)}={}){
  const value={keyId:'ingress-v1',audience:'synthetic-edge',timestamp:String(at/1000),nonce,sourceIp:'204.77.162.1',bodySha256:hash(body),clientId:'synthetic-client'};
  const signature=createHmac('sha256',Buffer.from(env.TRAINORACLE_GARMIN_INGRESS_SECRET_HEX,'hex')).update(signatureText(value)).digest('hex');
  return request('/webhooks/garmin',body,{'garmin-client-id':value.clientId,...Object.fromEntries(Object.entries(INGRESS_HEADERS).map(([name,header])=>[header,name==='signature'?signature:name==='version'?INGRESS_VERSION:value[name]])),...headers});
}
function setup({handler=()=>Response.json({ok:true}),runTask=async()=>{},claimTick=async()=>true,environment=env}={}){
  return createGarminEdgeHandler({env:environment,runtime:{handler,runTask,configured:true},now:()=>at,claimTick});
}

test('app route preserves JWT, consent and body while unknown/internal routes never reach core',async()=>{
  const seen=[];const handle=setup({handler:async(req,transport)=>{seen.push({path:new URL(req.url).pathname,body:await req.text(),authorization:req.headers.get('authorization'),revision:req.headers.get('x-trainoracle-storage-revision'),transport});return Response.json({ok:true});}});
  assert.equal((await handle(request('', '{"action":"status"}',{authorization:'Bearer synthetic-user','x-trainoracle-storage-revision':'3'}))).status,200);
  assert.deepEqual(seen,[{path:'/api/garmin-integration',body:'{"action":"status"}',authorization:'Bearer synthetic-user',revision:'3',transport:undefined}]);
  for(const suffix of ['/internal/garmin/process','/internal/garmin/events','/api/account-journal','/api/garmin-integration/extra','?action=tick'])assert.equal((await handle(request(suffix))).status,404);
  const stripped=new Request('https://edge.internal/garmin-integration',{method:'POST',body:'{}'});
  assert.equal((await handle(stripped)).status,200);
  assert.equal(seen.length,2);
});

test('real core still denies missing user credentials and direct task calls retain provider gates',async()=>{
  const runtime=createGarminRuntime({repository:{},vault:{},enabled:false});
  const handle=createGarminEdgeHandler({env,runtime,claimTick:async()=>true,now:()=>at});
  const denied=await handle(request('', '{"action":"status"}'));
  assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'AUTH_REQUIRED'});
  await assert.rejects(runtime.runTask('process'),error=>error.code==='PROVIDER_CONFIGURATION_PENDING');
  let runs=0;
  const enabled=createGarminRuntime({repository:{},vault:{},provider:{configHash:'a'.repeat(64),isCurrent:()=>true},enabled:true,push:{processOne:async()=>{runs++;return {processed:1};}}});
  assert.deepEqual(await enabled.runTask('process'),{processed:1});assert.equal(runs,1);
  await assert.rejects(enabled.runTask('events'),error=>error.code==='INVALID_INPUT');
});

test('Edge webhook requires a signed ingress and binds exact body, source and client metadata',async()=>{
  const seen=[];const handle=setup({handler:async(req,transport)=>{seen.push({body:await req.text(),peer:transport.peerAddress,client:req.headers.get('garmin-client-id'),forwarded:req.headers.get('cf-connecting-ip')});return Response.json({queued:1});}});
  assert.equal((await handle(request('/webhooks/garmin','{}',{'cf-connecting-ip':'204.77.162.1'}))).status,403);
  assert.equal((await handle(ingress({headers:{'garmin-client-id':'changed'}}))).status,403);
  const signed=ingress();assert.equal((await handle(new Request(signed.url,{method:'POST',headers:signed.headers,body:'tampered'}))).status,403);
  assert.equal(seen.length,0);
  assert.equal((await handle(ingress())).status,200);
  assert.deepEqual(seen,[{body:'{"activities":[]}',peer:'204.77.162.1',client:'synthetic-client',forwarded:null}]);
  assert.equal((await handle(ingress())).status,409);
  assert.equal(seen.length,1);
  assert.equal((await setup({environment:{...env,TRAINORACLE_GARMIN_INGRESS_MODE:'DIRECT'}})(ingress())).status,503);
});

test('cron rejects absent/forged/expired credentials and payloads before claiming or running work',async()=>{
  let claims=0,runs=0;const handle=setup({claimTick:async()=>{claims++;return true;},runTask:async()=>{runs++;}});
  const inputs=[request(CRON_PATH),request(CRON_PATH,'{}',{authorization:`Bearer ${env.SUPABASE_ANON_KEY}`}),tick({headers:{authorization:''}}),tick({headers:{[CRON_HEADERS.signature]:'aa'.repeat(32)}}),tick({fields:{keyId:'wrong'}}),tick({fields:{timestamp:String(at/1000-61)}}),tick({fields:{timestamp:String(at/1000+11)}}),tick({fields:{nonce:'bad'}}),tick({headers:{origin:'https://app.example.test'}}),tick({headers:{authorization:'Bearer synthetic-service'}}),tick({body:'{"task":"events"}'}),tick({body:'{ }'}),tick({headers:{'content-encoding':'gzip'}})];
  for(const input of inputs)assert.ok((await handle(input)).status>=400);
  assert.equal(claims,0);assert.equal(runs,0);
});

test('cron atomically claims across isolates and runs each fixed task once without HTTP',async()=>{
  const nonces=new Set(),seen=[];
  const claimTick=async claim=>{assert.match(claim.nonceHash,/^[a-f0-9]{64}$/);assert.equal(claim.timestamp,at/1000);if(nonces.has(claim.nonceHash))return false;nonces.add(claim.nonceHash);return true;};
  const make=()=>setup({claimTick,runTask:async task=>seen.push(task)});
  const first=await make()(tick());assert.equal(first.status,200);
  assert.deepEqual(seen,['process','autosave','maintenance','revocations']);
  assert.equal((await make()(tick())).status,409);assert.equal(seen.length,4);
  assert.equal((await make()(tick({fields:{nonce:'03'.repeat(16)}}))).status,200);assert.equal(seen.length,8);
});

test('cron gateway JWT alias stays separate from a modern API key and still needs HMAC',async()=>{
  let runs=0;const environment={...env,SUPABASE_ANON_KEY:'sb_publishable_synthetic',TRAINORACLE_GARMIN_GATEWAY_JWT:'synthetic-gateway-jwt'};
  const handle=setup({environment,runTask:async()=>runs++});
  assert.equal((await handle(tick({headers:{authorization:'Bearer sb_publishable_synthetic'}}))).status,403);
  assert.equal((await handle(request(CRON_PATH,'{}',{authorization:'Bearer synthetic-gateway-jwt'}))).status,403);
  assert.equal(runs,0);
  assert.equal((await handle(tick({headers:{authorization:'Bearer synthetic-gateway-jwt'}}))).status,200);
  assert.equal(runs,4);
  assert.equal((await setup()(tick())).status,200); // Existing legacy anon fallback.
});

test('DB claim failure stops work; task failure is sanitized and remaining maintenance proceeds',async()=>{
  let runs=0;assert.equal((await setup({claimTick:async()=>{throw new Error('private token');},runTask:async()=>runs++})(tick())).status,503);assert.equal(runs,0);
  const response=await setup({runTask:async task=>{runs++;if(task==='process')throw new Error('private health payload');}})(tick());
  assert.equal(response.status,503);assert.equal(runs,4);
  const result=await response.json();assert.equal(result.tasks.process,'RETRY_PENDING');assert.equal(result.tasks.maintenance,'COMPLETED');assert.equal(JSON.stringify(result).includes('private'),false);
});

test('tick claim sends only nonce metadata to exact RPC using server credential',async()=>{
  let seen;const claim=createTickClaim({env:{...env,SUPABASE_ANON_KEY:undefined},fetchImpl:async(url,init)=>{seen={url:String(url),...init};return Response.json({accepted:init.headers.apikey==='synthetic-service'},{status:init.headers.apikey==='synthetic-service'?200:401});}});
  assert.equal(await claim({nonceHash:'a'.repeat(64),timestamp:at/1000}),true);
  assert.equal(seen.url,'https://synthetic.supabase.co/rest/v1/rpc/garmin_edge_claim_tick');assert.equal(seen.redirect,'error');
  assert.deepEqual(JSON.parse(seen.body),{nonce_hash:'a'.repeat(64),signed_at:at/1000});assert.equal(seen.headers.authorization,'Bearer synthetic-service');assert.equal(seen.headers.apikey,'synthetic-service');
  assert.throws(()=>createTickClaim({env:{...env,SUPABASE_URL:'https://attacker.test/?redirect=1'}}));
  const rejected=createTickClaim({env,fetchImpl:async()=>Response.json({accepted:false})});assert.equal(await rejected({nonceHash:'a'.repeat(64),timestamp:at/1000}),false);
});
