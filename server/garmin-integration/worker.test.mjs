import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runGarminWorker,workerOptionsFromEnvironment} from './worker.mjs';
import {sign,VERSION} from './primitives.mjs';

const key=Buffer.alloc(32,93);
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
const responseFor=path=>path==='/internal/garmin/process'?{schemaVersion:VERSION,processed:1,reviewRequired:0,stale:0}:{schemaVersion:VERSION,completed:1,pending:0};
const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
const options=port=>({enabled:true,port,key,processIntervalMs:20,revocationIntervalMs:60,requestTimeoutMs:1000,maxBackoffMs:200,maxRunMs:5000});

test('CLI defaults OFF without a key or network; environment cannot supply a destination URL',async()=>{
  assert.deepEqual(workerOptionsFromEnvironment({TRAINORACLE_GARMIN_WORKER_URL:'https://evil.example/?token=secret'}),{enabled:false});
  assert.deepEqual(await runGarminWorker({enabled:false,port:1}),{reason:'DISABLED',attempts:0,failures:0});
  const output=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[fileURLToPath(new URL('./worker.mjs',import.meta.url))],{env:{},windowsHide:true});let out='',err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);child.on('error',reject);child.on('close',code=>resolve({code,out,err}));});
  assert.equal(output.code,0,output.err);assert.equal(output.err,'');assert.equal(output.out.trim(),'{"event":"WORKER_DISABLED"}');
  assert.throws(()=>workerOptionsFromEnvironment({TRAINORACLE_GARMIN_WORKER_ENABLED:'true',TRAINORACLE_GARMIN_RELAY_HTTP_KEY:key.toString('base64'),TRAINORACLE_GARMIN_WORKER_PORT:'8789/path'}));
});
test('once performs exactly two sequential loopback HMAC requests with safe aggregate-only logs',async()=>{
  const requests=[],logs=[];let active=0,maxActive=0;
  const server=createServer(async(req,res)=>{active++;maxActive=Math.max(maxActive,active);let body='';for await(const chunk of req)body+=chunk;requests.push({path:req.url,body,headers:req.headers});await new Promise(r=>setTimeout(r,10));active--;json(res,responseFor(req.url));});
  const port=await listen(server);
  try{const result=await runGarminWorker({...options(port),once:true,onEvent:e=>logs.push(e)});assert.equal(result.reason,'ONCE_COMPLETE');assert.equal(result.attempts,2);assert.equal(result.failures,0);assert.equal(maxActive,1);
    assert.deepEqual(requests.map(x=>x.path),['/internal/garmin/process','/internal/garmin/revocations']);
    for(const req of requests){assert.equal(req.body,'{}');assert.equal(req.headers['x-trainoracle-relay-signature'],sign(key,`${req.headers['x-trainoracle-relay-timestamp']}\n${req.path}\n{}`));assert.equal(req.headers.authorization,undefined);}
    const logText=JSON.stringify(logs);assert.ok(!logText.includes(key.toString('base64')));assert.ok(!logText.includes('signature'));assert.ok(!logText.includes('headers'));
  }finally{await close(server);}
});
test('redirects, raw/error bodies and request deadlines never leak content or follow a new destination',async()=>{
  let forwarded=0;const external=createServer((req,res)=>{forwarded++;res.end();});const externalPort=await listen(external);
  const logs=[];const server=createServer((req,res)=>{if(req.url.endsWith('/process')){res.writeHead(302,{location:`http://127.0.0.1:${externalPort}/PRIVATE_CANARY`});res.end('PRIVATE_CANARY');}else json(res,{schemaVersion:VERSION,completed:0,pending:0,rawToken:'PRIVATE_CANARY'});});const port=await listen(server);
  try{const result=await runGarminWorker({...options(port),once:true,onEvent:e=>logs.push(e)});assert.equal(result.failures,2);assert.equal(forwarded,0);assert.ok(!JSON.stringify(logs).includes('PRIVATE_CANARY'));
  }finally{await close(server);await close(external);}
  const stalled=createServer(()=>{}),stalledPort=await listen(stalled);const began=Date.now();
  try{const result=await runGarminWorker({...options(stalledPort),requestTimeoutMs:40,once:true});assert.equal(result.failures,2);assert.ok(Date.now()-began<2000);}finally{await close(stalled);}
});
test('failed tasks back off, successful recovery resets delay, and shutdown cancels sleep without another call',async()=>{
  const logs=[],calls=[];let processCalls=0;const stop=new AbortController();
  const server=createServer((req,res)=>{calls.push({path:req.url,at:Date.now()});if(req.url.endsWith('/process')&&++processCalls<=2)return json(res,{error:'PRIVATE_SERVER_ERROR_CANARY'},503);json(res,{...responseFor(req.url),...(req.url.endsWith('/process')?{processed:0}:{completed:0})});});const port=await listen(server);
  try{const result=await runGarminWorker({...options(port),signal:stop.signal,onEvent:event=>{logs.push(event);if(event.event==='WORKER_RECOVERED'&&event.task==='PROCESS')setTimeout(()=>stop.abort(),5);}});assert.equal(result.reason,'ABORTED');
    assert.deepEqual(logs.filter(e=>e.event==='WORKER_RETRY'&&e.task==='PROCESS').map(e=>e.delayMs),[40,80]);assert.equal(processCalls,3);assert.ok(logs.some(e=>e.event==='WORKER_RECOVERED'));assert.ok(!JSON.stringify(logs).includes('PRIVATE_SERVER_ERROR_CANARY'));
    const n=calls.length;await new Promise(r=>setTimeout(r,60));assert.equal(calls.length,n);
  }finally{await close(server);}
});
test('overall deadline aborts an in-flight request and finishes without starting the next task',async()=>{
  let calls=0;const server=createServer(()=>{calls++;}),port=await listen(server);
  try{const result=await runGarminWorker({...options(port),maxRunMs:50,requestTimeoutMs:1000});assert.equal(result.reason,'DEADLINE');assert.equal(calls,1);assert.equal(result.attempts,1);}finally{await close(server);}
});
