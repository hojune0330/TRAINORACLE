import {hkdfSync} from 'node:crypto';
import {keyBytes,sha,fail,boundedJson} from './primitives.mjs';

// The existing journal key never leaves the existing Supabase project. HKDF
// gives Garmin independent purpose keys, without six manually copied secrets.
// Pin the root key ID in DB: changing the journal's active encryption key must
// not silently change provider identity hashes or orphan saved credentials.
const PREFIX='trainoracle.garmin.edge.v1';
const setupErrors=new Set(['EDGE_SETUP_INVALID','EDGE_KEY_CHANGE_REQUIRES_MIGRATION','EDGE_EXISTING_DATA_REQUIRES_MIGRATION','EDGE_PROFILE_INVALID','EDGE_PROFILE_CHANGE_REQUIRES_REVIEW','EDGE_GATEWAY_INVALID']);
const sqlErrors=Object.freeze({'42501':'EDGE_DB_PERMISSION_DENIED','23514':'EDGE_DB_CHECK_CONSTRAINT','23502':'EDGE_DB_NOT_NULL','22P02':'EDGE_DB_INVALID_TEXT','42703':'EDGE_DB_COLUMN_MISSING','42883':'EDGE_DB_FUNCTION_MISSING','42P01':'EDGE_DB_TABLE_MISSING'});
const httpErrors=Object.freeze({401:'EDGE_RPC_UNAUTHORIZED',403:'EDGE_RPC_FORBIDDEN',404:'EDGE_RPC_NOT_FOUND'});
export async function edgeRpc(env,name,input,{fetchImpl=fetch}={}) {
  let base;try{base=new URL(env.SUPABASE_URL);}catch{fail(503,'EDGE_CONFIGURATION_PENDING');}
  if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash
    ||!env.SUPABASE_SERVICE_ROLE_KEY)fail(503,'EDGE_CONFIGURATION_PENDING');
  let response;try{response=await fetchImpl(new URL(`/rest/v1/rpc/${name}`,base),{
    method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'content-type':'application/json'},
    body:JSON.stringify(input),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
  });}catch{fail(503,'EDGE_CONFIGURATION_PENDING');}
  if(!response.ok){
    let problem;try{problem=await boundedJson(response,16000);}catch{}
    // Match only known fixed codes. PostgreSQL message/details can contain input
    // values, so never interpolate or return any part of an unknown response.
    const known=typeof problem?.message==='string'&&setupErrors.has(problem.message)?problem.message:undefined;
    fail(503,known??sqlErrors[problem?.code]??httpErrors[response.status]??'EDGE_CONFIGURATION_PENDING');
  }
  const value=await boundedJson(response,16000);
  if(value?.error)fail(503,'EDGE_CONFIGURATION_PENDING');return value;
}

export async function prepareEdgeEnvironment(source,{fetchImpl=fetch}={}) {
  const env={...source};
  // Modern Supabase publishable API keys are not JWTs. Keep the database API
  // key unchanged; the platform gateway uses the project's public legacy JWT.
  env.TRAINORACLE_GARMIN_GATEWAY_JWT??=env.SUPABASE_ANON_KEY;
  let ring;try{ring=JSON.parse(env.TRAINORACLE_JOURNAL_KEYRING_JSON);}catch{fail(503,'JOURNAL_KEY_UNAVAILABLE');}
  if(!ring?.keys||typeof ring.activeKeyId!=='string')fail(503,'JOURNAL_KEY_UNAVAILABLE');
  const metadata=await edgeRpc(env,'garmin_edge_bootstrap',{input:{action:'metadata'}},{fetchImpl});
  const rootId=metadata.rootKeyId??ring.activeKeyId;
  if(typeof rootId!=='string'||!/^[A-Za-z0-9._:-]{1,200}$/.test(rootId))fail(503,'JOURNAL_KEY_UNAVAILABLE');
  const root=keyBytes(ring.keys[rootId]);
  const id=sha(rootId).slice(0,16);
  const derive=purpose=>Buffer.from(hkdfSync('sha256',root,Buffer.from(PREFIX),Buffer.from(purpose),32)).toString('base64');
  try{
    env.TRAINORACLE_GARMIN_ROOT_KEY_ID=rootId;
    env.TRAINORACLE_GARMIN_ATTESTATION_JSON=JSON.stringify({keyId:`edge-runtime-${id}`,key:derive('runtime-attestation')});
    env.TRAINORACLE_GARMIN_RELAY_ATTESTATION_JSON=JSON.stringify({keyId:`edge-relay-${id}`,key:derive('relay-attestation')});
    env.TRAINORACLE_GARMIN_VAULT_JSON=JSON.stringify({activeKeyId:`edge-vault-${id}`,keys:{[`edge-vault-${id}`]:derive('provider-encryption')}});
    env.TRAINORACLE_GARMIN_IDENTITY_KEY=derive('provider-identity');
    delete env.TRAINORACLE_GARMIN_RELAY_HTTP_KEY;
    env.TRAINORACLE_GARMIN_CRON_KEY=derive('cron-trigger');
    env.TRAINORACLE_GARMIN_CRON_KEY_ID=`edge-cron-${id}`;
    env.TRAINORACLE_GARMIN_ALLOWED_ORIGINS??=env.TRAINORACLE_JOURNAL_ALLOWED_ORIGINS??'https://trainoracle.io';
    env.TRAINORACLE_GARMIN_PUSH_ENABLED??=env.TRAINORACLE_GARMIN_ENABLED??'false';
    env.TRAINORACLE_GARMIN_WORKER_ENABLED??=env.TRAINORACLE_GARMIN_ENABLED??'false';
    env.TRAINORACLE_GARMIN_INGRESS_MODE='CLOUDFLARE_SIGNED_V1';
    return env;
  }finally{root.fill(0);}
}

export async function bootstrapGarminEdge(env,configHash,{fetchImpl=fetch}={}) {
  const runtime=JSON.parse(env.TRAINORACLE_GARMIN_ATTESTATION_JSON);
  const relay=JSON.parse(env.TRAINORACLE_GARMIN_RELAY_ATTESTATION_JSON);
  let profile;try{profile=JSON.parse(env.TRAINORACLE_GARMIN_REVIEWED_PROFILE_JSON??'null');}catch{profile=null;}
  const hasProfile=/^[a-f0-9]{64}$/.test(configHash??'')&&configHash!=='0'.repeat(64)&&!!profile;
  return edgeRpc(env,'garmin_edge_bootstrap',{input:{action:'register',rootKeyId:env.TRAINORACLE_GARMIN_ROOT_KEY_ID,
    runtimeKeyId:runtime.keyId,runtimeKey:runtime.key,relayKeyId:relay.keyId,relayKey:relay.key,
    cronKeyId:env.TRAINORACLE_GARMIN_CRON_KEY_ID,cronKey:env.TRAINORACLE_GARMIN_CRON_KEY,gatewayJwt:env.TRAINORACLE_GARMIN_GATEWAY_JWT,
    configHash:hasProfile?configHash:null,evidenceReference:hasProfile?profile.evidenceReference:null,
    validUntil:hasProfile?profile.validUntil??null:null,
    enabled:hasProfile&&env.TRAINORACLE_GARMIN_ENABLED==='true'&&env.TRAINORACLE_GARMIN_PUSH_ENABLED==='true',
  }},{fetchImpl});
}
