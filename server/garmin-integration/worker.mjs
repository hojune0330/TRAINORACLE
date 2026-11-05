import {request as httpRequest} from 'node:http';
import {pathToFileURL} from 'node:url';
import {keyBytes,sign,VERSION,exact} from './primitives.mjs';

const TASKS=Object.freeze([
  {name:'AUTOSAVE',path:'/internal/garmin/autosave',interval:'processIntervalMs'},
  {name:'PROCESS',path:'/internal/garmin/process',interval:'processIntervalMs'},
  {name:'REVOCATIONS',path:'/internal/garmin/revocations',interval:'revocationIntervalMs'},
  {name:'MAINTENANCE',path:'/internal/garmin/maintenance',interval:'maintenanceIntervalMs'},
]);
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const defaultOptions=Object.freeze({port:8789,processIntervalMs:5000,revocationIntervalMs:60000,maintenanceIntervalMs:60000,
  requestTimeoutMs:30000,maxBackoffMs:300000,maxRunMs:86400000});
const sleep=(ms,signal)=>new Promise(resolve=>{
  if(signal.aborted)return resolve();
  const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};
  const timer=setTimeout(finish,ms);signal.addEventListener('abort',finish,{once:true});
});
function responseCounts(name,value){
  if(name==='AUTOSAVE'){
    if(!exact(value,['schemaVersion','saved','reviewRequired'])||value.schemaVersion!==VERSION||!integer(value.saved,0,1)||!integer(value.reviewRequired,0,1)||value.saved+value.reviewRequired>1)return null;
    return {saved:value.saved,reviewRequired:value.reviewRequired};
  }
  if(name==='MAINTENANCE'){
    if(!exact(value,['schemaVersion','checked','refreshed','reconnectRequired'])||value.schemaVersion!==VERSION
      ||!integer(value.checked,0,1)||!integer(value.refreshed,0,1)||!integer(value.reconnectRequired,0,1))return null;
    return {checked:value.checked,refreshed:value.refreshed,reconnectRequired:value.reconnectRequired};
  }
  if(name==='PROCESS'){
    if(!exact(value,['schemaVersion','processed','reviewRequired','stale'],['schemaVersion','processed','reviewRequired'])
      ||value.schemaVersion!==VERSION||!integer(value.processed,0,1)||!integer(value.reviewRequired,0,1)
      ||value.stale!==undefined&&!integer(value.stale,0,1)
      ||value.processed+value.reviewRequired+(value.stale??0)>1)return null;
    return {processed:value.processed,reviewRequired:value.reviewRequired,stale:value.stale??0};
  }
  if(!exact(value,['schemaVersion','completed','pending'])||value.schemaVersion!==VERSION
    ||!integer(value.completed,0,10)||!integer(value.pending,0,10)||value.completed+value.pending>10)return null;
  return {completed:value.completed,pending:value.pending};
}

/** Native HTTP deliberately ignores URL/proxy environment settings. Host and paths
 * are fixed, redirects are never followed, and each response has a total deadline
 * and byte bound. The key is used only for HMAC, never sent in a header or body. */
async function callTask(task,options,signal){
  const timestamp=String(Date.now()),controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),options.requestTimeoutMs);
  const combined=AbortSignal.any([signal,controller.signal]);
  try{return await new Promise(resolve=>{
    let settled=false;const finish=result=>{if(settled)return;settled=true;resolve(result);};
    const request=httpRequest({hostname:'127.0.0.1',port:options.port,path:task.path,method:'POST',agent:false,signal:combined,
      headers:{'content-type':'application/json','content-length':'2','cache-control':'no-store',
        'x-trainoracle-relay-timestamp':timestamp,
        'x-trainoracle-relay-signature':sign(options.key,`${timestamp}\n${task.path}\n{}`)}},response=>{
      if(response.statusCode!==200){finish({ok:false,failure:'HTTP_REJECTED'});response.destroy();return;}
      const chunks=[];let bytes=0;
      response.on('data',chunk=>{bytes+=chunk.length;if(bytes>4096){finish({ok:false,failure:'INVALID_RESPONSE'});response.destroy();return;}chunks.push(chunk);});
      response.on('error',()=>finish({ok:false,failure:signal.aborted?'STOPPED':'NETWORK_ERROR'}));
      response.on('aborted',()=>finish({ok:false,failure:signal.aborted?'STOPPED':'NETWORK_ERROR'}));
      response.on('end',()=>{try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));const counts=responseCounts(task.name,value);
        finish(counts?{ok:true,counts}:{ok:false,failure:'INVALID_RESPONSE'});}catch{finish({ok:false,failure:'INVALID_RESPONSE'});}});
    });
    request.on('error',()=>finish({ok:false,failure:signal.aborted?'STOPPED':controller.signal.aborted?'DEADLINE':'NETWORK_ERROR'}));
    request.end('{}');
  });}finally{clearTimeout(timer);}
}

/** One explicit worker instance, four independent schedules, no overlapping calls.
 * Disabling does not require a key and performs no I/O. onEvent receives only
 * fixed strings, attempt counts and validated aggregate counts, never payloads. */
export async function runGarminWorker(input={}){
  const emit=value=>{try{input.onEvent?.(value);}catch{/* Logging cannot expose a caught raw exception or break a durable retry. */}};
  if(input.enabled!==true){emit({event:'WORKER_DISABLED'});return {reason:'DISABLED',attempts:0,failures:0};}
  const options={...defaultOptions,...input};
  if(!integer(options.port,1,65535)||!Buffer.isBuffer(options.key)||options.key.length!==32
    ||!integer(options.processIntervalMs,1,60000)||!integer(options.revocationIntervalMs,1,1800000)
    ||!integer(options.maintenanceIntervalMs,1,1800000)
    ||!integer(options.requestTimeoutMs,1,30000)||!integer(options.maxBackoffMs,Math.max(options.processIntervalMs,options.revocationIntervalMs,options.maintenanceIntervalMs),1800000)
    ||!integer(options.maxRunMs,1,604800000))throw new Error('WORKER_CONFIGURATION_INVALID');
  const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),options.maxRunMs);
  const signal=AbortSignal.any([...(input.signal?[input.signal]:[]),deadline.signal]);
  const tasks=TASKS.map(task=>({...task,nextDue:0,consecutiveFailures:0}));
  let attempts=0,failures=0;
  emit({event:'WORKER_STARTED'});
  try{
    while(!signal.aborted){
      for(const task of tasks){
        if(signal.aborted)break;if(task.nextDue>Date.now())continue;
        const result=await callTask(task,options,signal);attempts++;
        if(signal.aborted)break;
        if(result.ok){
          const recovered=task.consecutiveFailures>0;task.consecutiveFailures=0;
          task.nextDue=Date.now()+options[task.interval];
          if(recovered||Object.values(result.counts).some(n=>n>0))emit({event:recovered?'WORKER_RECOVERED':'WORKER_PROGRESS',task:task.name,...result.counts});
        }else{
          failures++;task.consecutiveFailures++;
          const delayMs=Math.min(options.maxBackoffMs,options[task.interval]*2**Math.min(task.consecutiveFailures,20));
          task.nextDue=Date.now()+delayMs;
          emit({event:'WORKER_RETRY',task:task.name,failure:result.failure,delayMs});
        }
      }
      if(input.once||signal.aborted)break;
      await sleep(Math.max(1,Math.min(...tasks.map(task=>task.nextDue))-Date.now()),signal);
    }
  }finally{clearTimeout(timer);}
  const reason=deadline.signal.aborted?'DEADLINE':input.signal?.aborted?'ABORTED':'ONCE_COMPLETE';
  emit({event:'WORKER_STOPPED',reason,attempts,failures});return {reason,attempts,failures};
}

function envInteger(env,name,fallback,min,max){const raw=env[name];if(raw===undefined)return fallback;if(!/^[0-9]{1,9}$/.test(raw))throw new Error('WORKER_CONFIGURATION_INVALID');const value=Number(raw);if(!integer(value,min,max))throw new Error('WORKER_CONFIGURATION_INVALID');return value;}
export function workerOptionsFromEnvironment(env=process.env){
  if(env.TRAINORACLE_GARMIN_WORKER_ENABLED!=='true')return {enabled:false};
  const options={enabled:true,key:keyBytes(env.TRAINORACLE_GARMIN_RELAY_HTTP_KEY),
    port:envInteger(env,'TRAINORACLE_GARMIN_WORKER_PORT',8789,1,65535),
    processIntervalMs:envInteger(env,'TRAINORACLE_GARMIN_WORKER_PROCESS_INTERVAL_MS',5000,1000,60000),
    revocationIntervalMs:envInteger(env,'TRAINORACLE_GARMIN_WORKER_REVOCATION_INTERVAL_MS',60000,60000,1800000),
    maintenanceIntervalMs:envInteger(env,'TRAINORACLE_GARMIN_WORKER_MAINTENANCE_INTERVAL_MS',60000,60000,1800000),
    requestTimeoutMs:envInteger(env,'TRAINORACLE_GARMIN_WORKER_REQUEST_TIMEOUT_MS',30000,1000,30000),
    maxBackoffMs:envInteger(env,'TRAINORACLE_GARMIN_WORKER_MAX_BACKOFF_MS',300000,60000,1800000),
    maxRunMs:envInteger(env,'TRAINORACLE_GARMIN_WORKER_MAX_RUN_MS',86400000,1000,604800000)};
  if(options.maxBackoffMs<Math.max(options.processIntervalMs,options.revocationIntervalMs,options.maintenanceIntervalMs))throw new Error('WORKER_CONFIGURATION_INVALID');
  return options;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  let options;
  try{
    if(process.argv.slice(2).some(arg=>arg!=='--once')||process.argv.slice(2).length>1)throw new Error('WORKER_CONFIGURATION_INVALID');
    options=workerOptionsFromEnvironment();
    const result=await runGarminWorker({...options,once:process.argv.includes('--once'),signal:controller.signal,
      onEvent:value=>process.stdout.write(`${JSON.stringify(value)}\n`)});
    if(result.reason==='ONCE_COMPLETE'&&result.failures>0)process.exitCode=1;
  }catch{process.stderr.write('GARMIN_WORKER_CONFIGURATION_INVALID\n');process.exitCode=1;}
  finally{options?.key?.fill(0);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
