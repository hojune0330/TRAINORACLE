import {Buffer} from 'node:buffer';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {createSignedGarminIngress} from '../garmin-ingress/signed-ingress.mjs';
import {INGRESS_MODE,validId} from '../garmin-ingress/protocol.mjs';

// Existing Node-compatible pure adapters use Buffer; Deno does not promise the
// Node global. No listener, filesystem, or environment access is installed here.
globalThis.Buffer??=Buffer;

export const CRON_VERSION='TRAINORACLE_GARMIN_CRON_V1';
export const CRON_PATH='/internal/garmin/tick';
export const CRON_HEADERS=Object.freeze({keyId:'x-trainoracle-cron-key-id',timestamp:'x-trainoracle-cron-timestamp',nonce:'x-trainoracle-cron-nonce',signature:'x-trainoracle-cron-signature'});
const BASES=['/functions/v1/garmin-integration','/garmin-integration'];
const TASKS=Object.freeze(['process','autosave','maintenance','revocations']);
const hex64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const response=(status,value)=>Response.json(value,{status,headers:{'cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
class EdgeError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}}
const reject=(status=403,code='ACCESS_DENIED')=>{throw new EdgeError(status,code);};
const same=(a,b)=>hex64(a)&&hex64(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
export const cronSignatureText=({keyId,timestamp,nonce})=>[CRON_VERSION,keyId,'POST',CRON_PATH,timestamp,nonce,'{}'].join('\n');

function route(request){
  const url=new URL(request.url);if(url.search||url.hash)return null;
  for(const base of BASES){
    if(url.pathname===base)return '/api/garmin-integration';
    if(url.pathname===base+'/api/garmin-integration')return '/api/garmin-integration';
    for(const path of ['/webhooks/garmin',CRON_PATH,'/healthz'])if(url.pathname===base+path)return path;
  }
  return null;
}
async function emptyObjectBody(request){
  const length=request.headers.get('content-length');if(length!==null&&length!=='2')reject(422,'INVALID_INPUT');
  const reader=request.body?.getReader();if(!reader)reject(422,'INVALID_INPUT');
  let value='';try{while(true){const part=await reader.read();if(part.done)break;
    if(part.value.length+value.length>2){void reader.cancel().catch(()=>{});reject(422,'INVALID_INPUT');}
    value+=String.fromCharCode(...part.value);
  }}finally{reader.releaseLock();}
  if(value!=='{}')reject(422,'INVALID_INPUT');
}

/** This RPC atomically claims a nonce across all Edge isolates. It accepts only
 * the service role. Cron never receives that role credential. */
export function createTickClaim({env,fetchImpl=fetch}){
  let base;try{base=new URL(env.SUPABASE_URL);}catch{reject(503,'OPERATIONS_PENDING');}
  if(base.protocol!=='https:'||base.username||base.password||base.port||base.pathname!=='/'||base.search||base.hash
    ||!env.SUPABASE_SERVICE_ROLE_KEY)reject(503,'OPERATIONS_PENDING');
  const endpoint=new URL('/rest/v1/rpc/garmin_edge_claim_tick',base);
  return async({nonceHash,timestamp})=>{
    let result;try{result=await fetchImpl(endpoint,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
      headers:{'content-type':'application/json',apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`},
      body:JSON.stringify({nonce_hash:nonceHash,signed_at:timestamp})});}catch{reject(503,'OPERATIONS_PENDING');}
    if(!result.ok)reject(503,'OPERATIONS_PENDING');
    const reader=result.body?.getReader();if(!reader)reject(503,'OPERATIONS_PENDING');
    let size=0;const parts=[];try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024){void reader.cancel().catch(()=>{});reject(503,'OPERATIONS_PENDING');}parts.push(Buffer.from(part.value));}}finally{reader.releaseLock();}
    let value;try{value=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{reject(503,'OPERATIONS_PENDING');}
    return value?.accepted===true;
  };
}

/** All public paths are explicitly mapped. The original user JWT and consent
 * revision reach the existing handler; public callers never reach runTask. */
export function createGarminEdgeHandler({env,runtime,now=()=>Date.now(),fetchImpl=fetch,claimTick}={}){
  if(!runtime||typeof runtime.handler!=='function'||typeof runtime.runTask!=='function')reject(503,'OPERATIONS_PENDING');
  let signedIngress;
  const claim=claimTick??createTickClaim({env,fetchImpl});
  async function tick(request){
    if(env.TRAINORACLE_GARMIN_WORKER_ENABLED!=='true')reject(503,'OPERATIONS_PENDING');
    const gatewayJwt=env.TRAINORACLE_GARMIN_GATEWAY_JWT??env.SUPABASE_ANON_KEY;
    // The public anon JWT satisfies the still-enabled platform JWT gate. It is
    // not worker authority: the narrow HMAC and atomic nonce claim remain required.
    if(request.method!=='POST'||request.headers.has('origin')||request.headers.has('cookie')
      ||!gatewayJwt||request.headers.get('authorization')!==`Bearer ${gatewayJwt}`)reject();
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??'')
      ||request.headers.has('content-encoding')&&request.headers.get('content-encoding')!=='identity')reject(415,'CONTENT_TYPE_UNSUPPORTED');
    const fields=Object.fromEntries(Object.entries(CRON_HEADERS).map(([name,header])=>[name,request.headers.get(header)]));
    const encoded=env.TRAINORACLE_GARMIN_CRON_KEY;
    if(!validId(env.TRAINORACLE_GARMIN_CRON_KEY_ID)||typeof encoded!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))reject(503,'OPERATIONS_PENDING');
    if(fields.keyId!==env.TRAINORACLE_GARMIN_CRON_KEY_ID||!/^\d{10}$/.test(fields.timestamp??'')||!/^[a-f0-9]{32}$/.test(fields.nonce??'')||!hex64(fields.signature))reject();
    const timestamp=Number(fields.timestamp),current=()=>Math.floor(now()/1000);
    if(timestamp<current()-60||timestamp>current()+10)reject();
    const key=Buffer.from(encoded,'base64');if(key.length!==32||key.toString('base64')!==encoded)reject(503,'OPERATIONS_PENDING');
    const expected=createHmac('sha256',key).update(cronSignatureText(fields)).digest('hex');key.fill(0);
    if(!same(fields.signature,expected))reject();
    await emptyObjectBody(request);
    if(timestamp<current()-60||timestamp>current()+10)reject();
    const nonceHash=createHash('sha256').update(`${fields.keyId}:${fields.nonce}`).digest('hex');
    if(!await claim({nonceHash,timestamp}))reject(409,'TICK_REPLAY');
    // One leased item per task, bounded wall time. The database queue survives
    // interruption, and a later authenticated tick resumes expired leases.
    const started=now(),tasks={};let failed=false;
    for(const task of TASKS){
      if(now()-started>=45000){tasks[task]='DEFERRED';continue;}
      try{await runtime.runTask(task);tasks[task]='COMPLETED';}
      catch{tasks[task]='RETRY_PENDING';failed=true;}
    }
    return response(failed?503:200,{schemaVersion:CRON_VERSION,tasks});
  }
  return async request=>{
    try{
      const path=route(request);if(!path)return response(404,{error:'NOT_FOUND'});
      if(path==='/healthz')return ['GET','HEAD'].includes(request.method)
        ?response(200,{service:'trainoracle-garmin-edge',mode:runtime.configured?'CONFIGURED_UNVERIFIED':'PREPARATORY_DISABLED',evidence:{database:'NOT_PROBED',garmin:'NOT_PROBED'}})
        :response(405,{error:'METHOD_NOT_ALLOWED'});
      if(path===CRON_PATH)return await tick(request);
      const url=new URL(request.url);url.pathname=path;
      const rewritten=new Request(url,request);
      if(path==='/webhooks/garmin'){
        // No DIRECT mode on a public serverless origin, regardless of forwarded
        // headers. The existing verifier binds source IP, client ID and bytes.
        if(env.TRAINORACLE_GARMIN_INGRESS_MODE!==INGRESS_MODE)reject(503,'INGRESS_CONFIGURATION_PENDING');
        signedIngress??=createSignedGarminIngress(runtime.handler,{keyId:env.TRAINORACLE_GARMIN_INGRESS_KEY_ID,audience:env.TRAINORACLE_GARMIN_INGRESS_AUDIENCE,secretHex:env.TRAINORACLE_GARMIN_INGRESS_SECRET_HEX,now});
        return await signedIngress(rewritten);
      }
      return await runtime.handler(rewritten);
    }catch(error){return response(error instanceof EdgeError?error.status:503,{error:error instanceof EdgeError?error.code:'OPERATIONS_PENDING'});}
  };
}
