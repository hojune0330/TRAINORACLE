import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createServer} from 'node:http';
import {createGarminIngressWorker} from './worker.mjs';
import {createSignedGarminIngress,createIngressReplayCache,signedGarminIngressFromEnvironment} from './signed-ingress.mjs';
import {INGRESS_MODE,INGRESS_VERSION,INGRESS_HEADERS,INGRESS_BODY_MAX_BYTES,signatureText} from './protocol.mjs';
import {authenticateGarminPush,inCidrs} from '../garmin-integration/garmin-starter.mjs';
import {inCidrs as sharedInCidrs} from '../garmin-integration/delivery-source.mjs';

const at=Date.parse('2026-11-05T00:00:00Z'),config={keyId:'synthetic-v1',audience:'synthetic-gateway',secretHex:'ab'.repeat(32)};
const publicUrl='https://synthetic-ingress.example.test/webhooks/garmin',originUrl='https://synthetic-origin.example.test/webhooks/garmin';
const body='{"activities":[{"userId":"synthetic","summaryId":"activity-1"}]}',sourceIp='204.77.162.1';
const hash=value=>createHash('sha256').update(value).digest('hex');
function direct({url=publicUrl,method='POST',payload=body,headers={},cf=true}={}){
  const request=new Request(url,{method,headers:{'content-type':'application/json','cf-connecting-ip':sourceIp,...headers},...(['GET','HEAD'].includes(method)?{}:{body:payload})});
  if(cf)Object.defineProperty(request,'cf',{value:{colo:'ICN'}}); // Synthetic platform fixture, not deployment proof.
  return request;
}
function signed({url=originUrl,payload=body,method='POST',changes={},headers={}}={}){
  const fields={...config,timestamp:String(at/1000),nonce:'01'.repeat(16),sourceIp,bodySha256:hash(payload),clientId:'synthetic-client',...changes};
  const signature=createHmac('sha256',Buffer.from(config.secretHex,'hex')).update(signatureText(fields)).digest('hex');
  const values={'content-type':'application/json','garmin-client-id':fields.clientId,[INGRESS_HEADERS.version]:INGRESS_VERSION,[INGRESS_HEADERS.signature]:signature};
  for(const name of ['keyId','audience','timestamp','nonce','sourceIp','bodySha256'])values[INGRESS_HEADERS[name]]=fields[name];
  return new Request(url,{method,headers:{...values,...headers},...(['GET','HEAD'].includes(method)?{}:{body:payload})});
}
const node=(handler=()=>Response.json({queued:1}),options={})=>createSignedGarminIngress(handler,{...config,now:()=>at,...options});

test('Supabase origin keeps platform JWT and signed Garmin authentication together',async()=>{
  const hosted='https://texspxlpjungyarkvtkc.supabase.co/functions/v1/garmin-integration/webhooks/garmin';
  const gatewayAnonJwt=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role:'anon',ref:'texspxlpjungyarkvtkc'})).toString('base64url')}.synthetic`;
  let seen;
  const worker=createGarminIngressWorker({...config,publicUrl,originUrl:hosted,gatewayAnonJwt},{now:()=>at,fetchImpl:async(url,options)=>{
    seen={url,options};const rewritten=new Request(originUrl,options);
    return node()(rewritten);
  }});
  assert.equal((await worker.fetch(direct())).status,200);
  assert.equal(seen.url,hosted);assert.equal(seen.options.headers.get('authorization'),`Bearer ${gatewayAnonJwt}`);
  assert.match(seen.options.headers.get(INGRESS_HEADERS.signature),/^[a-f0-9]{64}$/);
  assert.throws(()=>createGarminIngressWorker({...config,publicUrl,originUrl:hosted}));
  assert.throws(()=>createGarminIngressWorker({...config,publicUrl:hosted,originUrl,gatewayAnonJwt}));
  assert.throws(()=>createGarminIngressWorker({...config,publicUrl,originUrl:hosted+'?redirect=other',gatewayAnonJwt}));
});

test('edge signs exact bytes and Node preserves them for existing Garmin source authentication',async()=>{
  const calls=[];
  const handler=node(async(request,transport)=>{
    authenticateGarminPush(request,transport.peerAddress,{clientId:'synthetic-client'});
    assert.equal(request.headers.get('authorization'),null);assert.equal(request.headers.get('cookie'),null);
    assert.equal(request.headers.get('x-trainoracle-peer-ip'),null);assert.equal(request.headers.get('x-forwarded-for'),null);
    assert.equal(request.headers.get(INGRESS_HEADERS.signature),null);
    assert.equal(await request.text(),body);assert.equal(transport.peerAddress,sourceIp);calls.push(1);
    return Response.json({queued:1,syntheticPrivateOriginField:'not-reflected'});
  });
  const worker=createGarminIngressWorker({...config,publicUrl,originUrl},{now:()=>at,fetchImpl:async(url,options)=>{
    assert.equal(url,originUrl);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
    assert.equal(options.headers.get('authorization'),null);assert.equal(options.headers.get('cf-connecting-ip'),null);
    return handler(new Request(url,options),{peerAddress:'127.0.0.1'});
  }});
  const response=await worker.fetch(direct({headers:{'garmin-client-id':'synthetic-client',authorization:'Bearer synthetic','cookie':'synthetic=yes','x-trainoracle-peer-ip':'1.1.1.1','x-forwarded-for':'1.1.1.1',[INGRESS_HEADERS.signature]:'forged'}}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{accepted:true});assert.equal(calls.length,1);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(inCidrs,sharedInCidrs);
});

test('Worker requires direct Cloudflare ingress and rejects spoofed/Worker source variants before forwarding',async()=>{
  let forwards=0;
  const worker=createGarminIngressWorker({...config,publicUrl,originUrl},{now:()=>at,fetchImpl:async()=>{forwards++;return Response.json({});}});
  for(const options of [
    {cf:false}, {headers:{'cf-worker':'attacker.example.test'}}, {headers:{'cf-worker':''}},
    {headers:{'x-real-ip':sourceIp}}, {headers:{'cf-connecting-ip':'203.0.113.2','x-forwarded-for':sourceIp}},
    {headers:{'cf-connecting-ip':'2a06:98c0:3600::103'}}, {headers:{'cf-connecting-ip':`${sourceIp}, 1.1.1.1`}},
    {headers:{'cf-connecting-ip':'204.077.162.1'}}, {headers:{origin:'https://synthetic-app.example.test'}},
    {url:publicUrl+'?destination=elsewhere'}, {url:publicUrl.replace('synthetic-ingress','another-ingress')}, {method:'GET'},
  ])assert.equal((await worker.fetch(direct(options))).status,403,JSON.stringify(options));
  assert.equal(forwards,0);
});

test('signed mode rejects direct bypass even from Garmin CIDR and ignores forged hosting proxy headers',async()=>{
  let calls=0;const handler=node(()=>{calls++;return Response.json({});});
  for(const peerAddress of [sourceIp,'127.0.0.1','::ffff:127.0.0.1']){
    assert.equal((await handler(direct({url:originUrl,headers:{'x-trainoracle-peer-ip':sourceIp,'cf-connecting-ip':sourceIp}}),{peerAddress})).status,403);
  }
  assert.equal(calls,0);
});

test('HMAC binds audience/key/source/nonce/time/client metadata and exact request route',async()=>{
  let calls=0;
  for(const options of [
    {headers:{[INGRESS_HEADERS.signature]:'ff'.repeat(32)}}, {headers:{[INGRESS_HEADERS.signature]:'aa'}},
    {headers:{[INGRESS_HEADERS.keyId]:'other'}}, {headers:{[INGRESS_HEADERS.audience]:'other'}},
    {headers:{[INGRESS_HEADERS.sourceIp]:'204.77.162.2'}}, {headers:{[INGRESS_HEADERS.nonce]:'02'.repeat(16)}},
    {headers:{[INGRESS_HEADERS.timestamp]:String(at/1000-1)}}, {headers:{'garmin-client-id':'tampered'}},
    {headers:{[INGRESS_HEADERS.bodySha256]:'ff'.repeat(32)}}, {headers:{[INGRESS_HEADERS.version]:'V2'}},
    {changes:{sourceIp:'203.0.113.1'}}, {changes:{audience:'other'}}, {changes:{keyId:'other'}},
    {url:originUrl+'?extra=1'}, {method:'PUT'},
  ]){
    const response=await node(()=>{calls++;return Response.json({});})(signed(options));
    assert.equal(response.status,403,JSON.stringify(options));
  }
  const good=signed(),headers=new Headers(good.headers);assert.equal((await node()(new Request(originUrl,{method:'POST',headers,body:body+' '}))).status,403);
  assert.equal(calls,0);
});

test('old/future signatures fail and signed time is rechecked after streaming the body',async()=>{
  for(const delta of [-121,11])assert.equal((await node()(signed({changes:{timestamp:String(at/1000+delta)}}))).status,403);
  for(const delta of [-120,10])assert.equal((await node()(signed({changes:{timestamp:String(at/1000+delta)}}))).status,200);
  let reads=0;
  assert.equal((await node(undefined,{now:()=>++reads===1?at:at+121000})(signed())).status,403);
  assert.equal(reads,2);
});

test('authenticated duplicate is rejected atomically and legitimate provider retry receives a fresh nonce',async()=>{
  let calls=0,release;const pending=new Promise(resolve=>{release=resolve;});
  const handler=node(async()=>{calls++;await pending;return Response.json({queued:1});});
  const first=handler(signed());await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await handler(signed())).status,409);assert.equal(calls,1);release();assert.equal((await first).status,200);
  assert.equal((await handler(signed({changes:{nonce:'03'.repeat(16)}}))).status,200);assert.equal(calls,2);
});

test('bounded replay cache fails closed at capacity and expires only out-of-window entries',async()=>{
  let clock=at;const handler=node(undefined,{now:()=>clock,replayCache:createIngressReplayCache({maxEntries:1})});
  assert.equal((await handler(signed())).status,200);
  assert.equal((await handler(signed({changes:{nonce:'02'.repeat(16)}}))).status,503);
  assert.equal((await handler(signed())).status,409);
  clock+=121000;
  assert.equal((await handler(signed({changes:{timestamp:String(clock/1000),nonce:'02'.repeat(16)}}))).status,200);
  assert.equal((await handler(signed())).status,403);
});

test('bounded bytes reject excess/encoding/false Content-Length, with no handler or edge forward',async()=>{
  let calls=0;
  const handler=node(()=>{calls++;return Response.json({});});
  for(const options of [
    {headers:{'content-length':String(INGRESS_BODY_MAX_BYTES+1)}},
    {headers:{'content-length':'10'}}, {headers:{'content-encoding':'gzip'}},
    {headers:{'content-type':'text/plain'}}, {payload:'x'.repeat(INGRESS_BODY_MAX_BYTES+1)},
  ])assert.ok([413,415,422].includes((await handler(signed(options))).status));
  const worker=createGarminIngressWorker({...config,publicUrl,originUrl},{now:()=>at,fetchImpl:async()=>{calls++;return Response.json({});}});
  assert.equal((await worker.fetch(direct({headers:{'content-length':String(INGRESS_BODY_MAX_BYTES+1)}}))).status,413);
  assert.equal((await worker.fetch(direct({payload:'x'.repeat(INGRESS_BODY_MAX_BYTES+1)}))).status,413);
  assert.equal(calls,0);
});

test('origin failure/redirect/network exception never becomes ACK and raw origin data is not reflected',async()=>{
  for(const status of [204,301,400,403,409,413,422,429,500,503]){
    const worker=createGarminIngressWorker({...config,publicUrl,originUrl},{now:()=>at,fetchImpl:async()=>new Response(status===204?null:'SYNTHETIC_PRIVATE',{status,headers:{location:'https://elsewhere.example.test','set-cookie':'private=yes'}})});
    const response=await worker.fetch(direct());assert.notEqual(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('location'),null);assert.equal((await response.text()).includes('SYNTHETIC_PRIVATE'),false);
  }
  const worker=createGarminIngressWorker({...config,publicUrl,originUrl},{now:()=>at,fetchImpl:async()=>{throw new Error('SYNTHETIC_SECRET');}});
  assert.deepEqual(await (await worker.fetch(direct())).json(),{error:'INGRESS_UNAVAILABLE'});
});

test('fixed HTTPS destinations and explicit signed mode reject malformed configuration',async()=>{
  for(const change of [{secretHex:''},{keyId:'bad\nid'},{audience:''},{publicUrl:publicUrl+'?q=1'},{originUrl:'http://origin.example.test/webhooks/garmin'},{originUrl:originUrl+'#fragment'},{originUrl:originUrl.replace('https://','https://user:pass@')},{originUrl:publicUrl}])assert.throws(()=>createGarminIngressWorker({...config,publicUrl,originUrl,...change}));
  const handler=()=>Response.json({});assert.equal(signedGarminIngressFromEnvironment(handler,{}),handler);
  assert.throws(()=>signedGarminIngressFromEnvironment(handler,{TRAINORACLE_GARMIN_INGRESS_MODE:'UNKNOWN'}));
  assert.throws(()=>signedGarminIngressFromEnvironment(handler,{TRAINORACLE_GARMIN_INGRESS_MODE:INGRESS_MODE}));
  const wrapped=signedGarminIngressFromEnvironment(handler,{TRAINORACLE_GARMIN_INGRESS_MODE:INGRESS_MODE,TRAINORACLE_GARMIN_INGRESS_KEY_ID:config.keyId,TRAINORACLE_GARMIN_INGRESS_AUDIENCE:config.audience,TRAINORACLE_GARMIN_INGRESS_SECRET_HEX:config.secretHex});
  assert.equal((await wrapped(direct({url:originUrl}))).status,403);
});

test('other account/API routes retain their original transport and body',async()=>{
  const transport={peerAddress:'127.0.0.1'},request=new Request('https://origin.example.test/api/account-journal',{method:'POST',body:'synthetic'});
  const response=await node(async(received,peer)=>{assert.equal(received,request);assert.equal(peer,transport);return Response.json({ok:true});})(request,transport);
  assert.equal(response.status,200);
});

test('real local HTTP hop preserves signed bytes; direct network bypass is denied',async()=>{
  let accepted=0,transportError;
  const handler=node(async(request,transport)=>{authenticateGarminPush(request,transport.peerAddress,{clientId:'synthetic-client'});assert.equal(await request.text(),body);accepted++;return Response.json({queued:1});});
  const server=createServer(async(req,res)=>{
    const request=new Request(`http://localhost${req.url}`,{method:req.method,headers:req.headers,body:req,duplex:'half'});
    const response=await handler(request,{peerAddress:req.socket.remoteAddress});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const local=`http://127.0.0.1:${server.address().port}/webhooks/garmin`;
  try{
    const worker=createGarminIngressWorker({...config,publicUrl,originUrl},{now:()=>at,fetchImpl:async(_url,options)=>{try{return await fetch(local,options);}catch(error){transportError=error;throw error;}}});
    assert.equal((await worker.fetch(direct({headers:{'garmin-client-id':'synthetic-client'}}))).status,200,transportError?`${transportError.name}: ${transportError.cause?.code??transportError.message}`:undefined);
    assert.equal((await fetch(local,{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':sourceIp,'x-trainoracle-peer-ip':sourceIp},body})).status,403);
    assert.equal(accepted,1);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
