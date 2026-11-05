import {prepareEdgeEnvironment,bootstrapGarminEdge} from '../../../server/garmin-integration/edge-environment.mjs';
import {createGarminEdgeHandler} from '../../../server/garmin-integration/edge-runtime.mjs';
import {runtimeFromEnvironment} from '../../../server/garmin-integration/service.mjs';

// verify_jwt=true keeps the platform gate. App requests carry their user JWT;
// Cloudflare and Cron carry the existing public anon JWT, which grants no work
// authority by itself. App requests additionally use auth.getUser + session/
// consent RPC checks, Garmin requires its signed envelope, and Cron requires its
// narrow HMAC + atomic nonce claim.
// Initialization never exports keys or logs provider/user payloads. A failed
// bootstrap is retried on a later request rather than poisoning this isolate.
let handlerPromise: Promise<(request: Request) => Promise<Response>> | undefined;
const stages=new Set(['ENVIRONMENT','RUNTIME','BOOTSTRAP','ROUTING']);
const codes=new Set(['EDGE_CONFIGURATION_PENDING','JOURNAL_KEY_UNAVAILABLE','KEY_UNAVAILABLE','CONFIGURATION_INVALID','PROVIDER_CONFIGURATION_PENDING','INVALID_INPUT',
  'EDGE_SETUP_INVALID','EDGE_KEY_CHANGE_REQUIRES_MIGRATION','EDGE_EXISTING_DATA_REQUIRES_MIGRATION','EDGE_PROFILE_INVALID','EDGE_PROFILE_CHANGE_REQUIRES_REVIEW','EDGE_GATEWAY_INVALID',
  'EDGE_DB_PERMISSION_DENIED','EDGE_DB_CHECK_CONSTRAINT','EDGE_DB_NOT_NULL','EDGE_DB_INVALID_TEXT','EDGE_DB_COLUMN_MISSING','EDGE_DB_FUNCTION_MISSING','EDGE_DB_TABLE_MISSING','EDGE_RPC_UNAUTHORIZED','EDGE_RPC_FORBIDDEN','EDGE_RPC_NOT_FOUND']);
async function initialize() {
  let stage='ENVIRONMENT';
  try {
    const env=await prepareEdgeEnvironment(Deno.env.toObject());
    stage='RUNTIME';
    const runtime=await runtimeFromEnvironment(env,{inProcessTasks:true});
    stage='BOOTSTRAP';
    await bootstrapGarminEdge(env,runtime.configHash);
    stage='ROUTING';
    return createGarminEdgeHandler({env,runtime});
  } catch (error: unknown) {
    const candidate=(error as {code?:unknown})?.code;
    throw Object.assign(new Error('INITIALIZATION_FAILED'),{stage,code:typeof candidate==='string'&&codes.has(candidate)?candidate:'UNCLASSIFIED'});
  }
}
Deno.serve(async (request: Request) => {
  try {
    handlerPromise??=initialize().catch((error: unknown)=>{handlerPromise=undefined;throw error;});
    return await (await handlerPromise)(request);
  } catch (error: unknown) {
    const failure=error as {stage?:unknown;code?:unknown};
    const health=new URL(request.url).pathname.endsWith('/garmin-integration/healthz');
    // Only fixed allowlisted stage/code labels; never exception text, stack,
    // request contents, key IDs or environment values, even on this health path.
    const diagnostic=health?{stage:typeof failure?.stage==='string'&&stages.has(failure.stage)?failure.stage:'UNKNOWN',code:typeof failure?.code==='string'&&(codes.has(failure.code)||failure.code==='UNCLASSIFIED')?failure.code:'UNCLASSIFIED'}:undefined;
    return Response.json({error:'OPERATIONS_PENDING',...(diagnostic?{diagnostic}:{})},{status:503,headers:{'cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff'}});
  }
});
