import { boundedJson, fail, keyBytes, sign, trustedUrl, UUID } from './primitives.mjs';

/** All table access is behind the narrowly attested RPC. A browser JWT cannot read
 * tokens or bypass the company gateway, even if it calls PostgREST directly. */
export function createSupabaseRepository({url,publishableKey,attestation,relayAttestation,serviceRoleKey,allowLocalHttp=false,fetchImpl=fetch}) {
  const base=trustedUrl(url,allowLocalHttp);if(base.pathname!=='/'||!publishableKey)fail(503,'CONFIGURATION_INVALID');
  const secret=keyBytes(attestation?.key),relaySecret=relayAttestation?keyBytes(relayAttestation.key):null;
  async function request(path,token,body,consentRevision){let response;try{response=await fetchImpl(new URL(path,base),{method:body?'POST':'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{apikey:publishableKey,authorization:`Bearer ${token}`,'content-type':'application/json',...(consentRevision?{'x-trainoracle-storage-revision':String(consentRevision)}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{fail(503,'OPERATIONS_PENDING');}
    if(!response.ok)fail(response.status===401?401:response.status===403?403:503,response.status===401?'AUTH_REQUIRED':response.status===403?'ACCESS_DENIED':'OPERATIONS_PENDING');
    return boundedJson(response,9_000_000);
  }
  async function invoke(input,auth,relay,maintenance=false,autosave=false){const request_text=JSON.stringify({...input,domain:autosave?'trainoracle.garmin.autosave.v1':maintenance?'trainoracle.garmin.maintenance.v1':'trainoracle.garmin.integration.v1',expiresAt:Math.floor(Date.now()/1000)+60,...(relay?{}:{ownerId:auth.ownerId,sessionId:auth.sessionId})});
    const result=await request(`/rest/v1/rpc/${autosave?'garmin_autosave_attested':maintenance?'garmin_maintenance_attested':'garmin_integration_attested'}`,relay?serviceRoleKey:auth.token,{request_text,signature:sign(relay?relaySecret:secret,request_text),key_id:relay?relayAttestation.keyId:attestation.keyId},autosave&&relay?input.consentRevision:auth?.consentRevision);
    if(result?.error){const code=result.error;fail(code==='OPERATIONS_PENDING'?503:409,code);}return result;
  }
  return {
    async authenticate(token,consentRevision){const user=await request('/auth/v1/user',token);let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{fail(401,'AUTH_REQUIRED');}
      if(!UUID.test(user.id??'')||claims.sub!==user.id||!UUID.test(claims.session_id??'')||claims.exp*1000<=Date.now())fail(401,'AUTH_REQUIRED');return {ownerId:user.id,sessionId:claims.session_id,token,consentRevision};},
    call:(auth,input)=>invoke({...input,consentRevision:auth.consentRevision},auth,false),
    autosave(auth,input){if(!auth&&(!relaySecret||!serviceRoleKey))fail(503,'OPERATIONS_PENDING');return invoke({...input,...(auth?{consentRevision:auth.consentRevision}:{})},auth,!auth,false,true);},
    relay(input){if(!relaySecret||!serviceRoleKey)fail(503,'OPERATIONS_PENDING');return invoke(input,null,true);},
    maintenance(input){if(!relaySecret||!serviceRoleKey)fail(503,'OPERATIONS_PENDING');return invoke(input,null,true,true);},
  };
}
