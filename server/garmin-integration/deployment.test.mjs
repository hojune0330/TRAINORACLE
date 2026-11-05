import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,createHmac} from 'node:crypto';
import {startGarminDeployment} from './deployment.mjs';
import {sign,VERSION} from './primitives.mjs';
import {INGRESS_MODE,INGRESS_VERSION,INGRESS_HEADERS,signatureText} from '../garmin-ingress/protocol.mjs';

const revision='c'.repeat(40),key=Buffer.alloc(32,77);
const waitFor=async predicate=>{const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)assert.fail('local condition deadline');await new Promise(resolve=>setTimeout(resolve,10));}};

test('keyless default starts health with source revision, no backend claims or internal/public bypass',async()=>{
  const events=[];const deployment=await startGarminDeployment({env:{PORT:'0',RENDER_GIT_COMMIT:revision},onEvent:e=>events.push(e)});
  const url=`http://127.0.0.1:${deployment.port}`;
  try{
    const response=await fetch(`${url}/healthz`),health=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(health,{service:'trainoracle-garmin',status:'ok',mode:'PREPARATORY_DISABLED',sourceRevision:revision,evidence:{process:'RUNNING',database:'NOT_PROBED',garmin:'NOT_PROBED'},accountGateway:'DISABLED'});
    assert.equal((await fetch(`${url}/healthz`,{method:'HEAD'})).status,200);
    for(const path of ['/internal/garmin/autosave','/internal/garmin/process','/internal/garmin/revocations','/internal/garmin/maintenance','/internal/garmin/events','/unrecognized'])assert.equal((await fetch(url+path,{method:'POST',body:'{}'})).status,404);
    assert.equal((await fetch(`${url}/api/garmin-integration`,{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"connect"}'})).status,503);
    assert.equal((await fetch(`${url}/api/account-journal`,{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"status"}'})).status,503);
    assert.equal((await fetch(`${url}/webhooks/garmin`,{method:'POST',body:'{}','headers':{'x-trainoracle-peer-ip':'204.77.162.1'}})).status,503);
  }finally{await deployment.stop();}
  assert.deepEqual(await deployment.finished,{failed:false});assert.equal(events.some(e=>e.event.startsWith('WORKER_')),false);
});

test('one supervised real loopback worker signs requests; public transport keeps actual peer, internal routes stay closed',async()=>{
  const calls=[],events=[];const controller=new AbortController();
  const runtimeFactory=async()=>({configured:true,handler:async(request,transport)=>{
    const path=new URL(request.url).pathname;
    if(path.startsWith('/internal/')){
      const body=await request.text(),timestamp=request.headers.get('x-trainoracle-relay-timestamp');
      assert.equal(body,'{}');assert.equal(request.headers.get('x-trainoracle-relay-signature'),sign(key,`${timestamp}\n${path}\n{}`));
      assert.equal(transport.peerAddress,'127.0.0.1');calls.push(path);
      return Response.json({schemaVersion:VERSION,...(path.endsWith('/autosave')?{saved:0,reviewRequired:0}:path.endsWith('/maintenance')?{checked:0,refreshed:0,reconnectRequired:0}:path.endsWith('/process')?{processed:0,reviewRequired:0}:{completed:0,pending:0})});
    }
    return Response.json({peerAddress:transport.peerAddress});
  }});
  const deployment=await startGarminDeployment({env:{PORT:'0',TRAINORACLE_GARMIN_ENABLED:'true',TRAINORACLE_GARMIN_PUSH_ENABLED:'true',TRAINORACLE_GARMIN_WORKER_ENABLED:'true',TRAINORACLE_GARMIN_RELAY_HTTP_KEY:key.toString('base64')},runtimeFactory,signal:controller.signal,onEvent:e=>events.push(e)});
  try{
    await waitFor(()=>calls.length===4);assert.deepEqual(calls,['/internal/garmin/autosave','/internal/garmin/process','/internal/garmin/revocations','/internal/garmin/maintenance']);
    const base=`http://127.0.0.1:${deployment.port}`;
    const response=await fetch(`${base}/webhooks/garmin`,{method:'POST',body:'{}',headers:{'x-trainoracle-peer-ip':'204.77.162.1','x-forwarded-for':'204.77.162.1'}});
    assert.equal((await response.json()).peerAddress,'127.0.0.1');
    assert.equal((await fetch(`${base}/internal/garmin/process`,{method:'POST',body:'{}'})).status,404);
  }finally{controller.abort();await deployment.finished;}
  assert.equal(events.filter(e=>e.event==='WORKER_STARTED').length,1);assert.deepEqual(await deployment.finished,{failed:false});
});

test('enabled incomplete configuration fails startup and worker failure stops the process without raw errors',async()=>{
  await assert.rejects(startGarminDeployment({env:{PORT:'0',TRAINORACLE_GARMIN_ENABLED:'true'}}),/DEPLOYMENT_CONFIGURATION_INVALID/);
  const events=[];
  const deployment=await startGarminDeployment({env:{PORT:'0',RENDER_GIT_COMMIT:'unsafe-value',TRAINORACLE_GARMIN_WORKER_ENABLED:'true',TRAINORACLE_GARMIN_RELAY_HTTP_KEY:key.toString('base64')},
    runtimeFactory:async()=>({configured:true,handler:async()=>Response.json({})}),workerRunner:async()=>{throw new Error('SYNTHETIC_RAW_CREDENTIAL');},onEvent:e=>events.push(e)});
  assert.deepEqual(await deployment.finished,{failed:true});assert.equal(JSON.stringify(events).includes('SYNTHETIC_RAW_CREDENTIAL'),false);assert.equal(deployment.health().sourceRevision,null);
});

test('public signed ingress wiring rejects direct requests and only verified source reaches the original handler',async()=>{
  const config={keyId:'synthetic-v1',audience:'synthetic-gateway',secretHex:'ab'.repeat(32)},calls=[];
  const env={PORT:'0',TRAINORACLE_GARMIN_INGRESS_MODE:INGRESS_MODE,TRAINORACLE_GARMIN_INGRESS_KEY_ID:config.keyId,
    TRAINORACLE_GARMIN_INGRESS_AUDIENCE:config.audience,TRAINORACLE_GARMIN_INGRESS_SECRET_HEX:config.secretHex};
  const runtimeFactory=async()=>({configured:true,handler:async(request,transport)=>{
    calls.push({path:new URL(request.url).pathname,transport,forwarded:request.headers.get('x-forwarded-for'),signature:request.headers.get(INGRESS_HEADERS.signature)});
    return Response.json({accepted:true});
  }});
  const deployment=await startGarminDeployment({env,runtimeFactory}),base=`http://127.0.0.1:${deployment.port}`;
  try{
    const body='{}',plain={'content-type':'application/json','x-forwarded-for':'204.77.162.1','x-trainoracle-peer-ip':'204.77.162.1'};
    assert.equal((await fetch(base+'/webhooks/garmin',{method:'POST',body,headers:plain})).status,403);assert.equal(calls.length,0);
    const fields={...config,timestamp:String(Math.floor(Date.now()/1000)),nonce:'01'.repeat(16),sourceIp:'204.77.162.1',bodySha256:createHash('sha256').update(body).digest('hex'),clientId:''};
    const headers={...plain,[INGRESS_HEADERS.version]:INGRESS_VERSION,[INGRESS_HEADERS.signature]:createHmac('sha256',Buffer.from(config.secretHex,'hex')).update(signatureText(fields)).digest('hex')};
    for(const name of ['keyId','audience','timestamp','nonce','sourceIp','bodySha256'])headers[INGRESS_HEADERS[name]]=fields[name];
    assert.equal((await fetch(base+'/webhooks/garmin',{method:'POST',body,headers})).status,200);
    assert.equal(calls[0].transport.peerAddress,fields.sourceIp);assert.equal(calls[0].forwarded,null);assert.equal(calls[0].signature,null);
    assert.equal((await fetch(base+'/webhooks/garmin',{method:'POST',body,headers})).status,409);assert.equal(calls.length,1);
    assert.equal((await fetch(base+'/api/garmin-integration',{method:'POST',body,headers:plain})).status,200);
    assert.equal(calls[1].transport.peerAddress,'127.0.0.1');
    assert.equal((await fetch(base+'/internal/garmin/maintenance',{method:'POST',body,headers})).status,404);
  }finally{await deployment.stop();}
  await assert.rejects(startGarminDeployment({env:{PORT:'0',TRAINORACLE_GARMIN_INGRESS_MODE:INGRESS_MODE},runtimeFactory}));
});

test('formal migration is exactly the reviewed SQL exercised by the real HTTP/SQL integration suite',async()=>{
  const candidate=await readFile(new URL('./schema-candidate.sql',import.meta.url),'utf8');
  const formal=await readFile(new URL('../../supabase/migrations/20261104103908_garmin_integration_runtime.sql',import.meta.url),'utf8');
  assert.equal(formal,candidate);
  assert.equal(await readFile(new URL('../../supabase/migrations/20261104231500_garmin_credential_maintenance.sql',import.meta.url),'utf8'),
    await readFile(new URL('./schema-maintenance-candidate.sql',import.meta.url),'utf8'));
});
