import { boundedJson, canonical, fail, ID, object, sha, trustedUrl } from './primitives.mjs';

/** Generic standards-based adapter, NOT a claim about Garmin endpoint names,
 * scopes, response fields, push signatures or revision ordering. The exact profile
 * requires reviewed vendor documentation and a matching server-owned DB approval.
 * No Garmin network address is compiled into this service. */
export function createReviewedProvider(config, {allowLocalHttp=false,fetchImpl=fetch,now=()=>Date.now()}={}) {
  // Operating approval has no invented renewal deadline. An explicitly supplied
  // deadline remains binding; OAuth access/refresh expiry is a separate contract.
  const validUntil=config?.validUntil==null?null:typeof config.validUntil==='string'?Date.parse(config.validUntil):NaN;
  const current=()=>validUntil===null||Number.isFinite(validUntil)&&validUntil>now();
  if(!object(config)||config.protocol!=='OAUTH2_AUTHORIZATION_CODE_PKCE'
    ||!ID.test(config.evidenceReference??'')||!current()||!config.clientId
    ||!['none','client_secret_basic','client_secret_post'].includes(config.tokenAuth)
    ||config.tokenAuth!=='none'&&(!config.clientSecret||typeof config.clientSecret!=='string')
    ||!Array.isArray(config.scopes)||!config.scopes.length||config.scopes.some(s=>typeof s!=='string'||!/^[\x21\x23-\x5B\x5D-\x7E]{1,200}$/.test(s))
    ||typeof config.subjectField!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(config.subjectField)
    ||!Array.isArray(config.allowedDetailFields)||config.allowedDetailFields.some(f=>!['heartRateBpm','powerWatts','cadenceSpm','speedMetersPerSecond','altitudeMeters','latitude','longitude','timerSeconds','clockSeconds','movingSeconds','totalDistanceMeters','bikeCadenceRpm','swimCadenceSpm','airTemperatureCelsius'].includes(f))
    ||!['MONOTONIC_ACTIVITY_REVISION_ATTESTED_BY_RELAY','NO_SOURCE_REVISION_CONSERVATIVE_CONFLICT'].includes(config.revisionSemantics))fail(503,'PROVIDER_CONFIGURATION_PENDING');
  const urls=Object.fromEntries(['authorizationEndpoint','tokenEndpoint','subjectEndpoint'].map(k=>[k,trustedUrl(config[k],allowLocalHttp)]));
  if(config.permissionsEndpoint)urls.permissionsEndpoint=trustedUrl(config.permissionsEndpoint,allowLocalHttp);
  if(config.revocationEndpoint)urls.revocationEndpoint=trustedUrl(config.revocationEndpoint,allowLocalHttp);
  let redirect;try{redirect=new URL(config.redirectUri);}catch{fail(503,'CONFIGURATION_INVALID');}
  if(redirect.username||redirect.password||redirect.hash||redirect.search&&redirect.search!=='?garmin_callback=1')fail(503,'CONFIGURATION_INVALID');
  trustedUrl(`${redirect.origin}${redirect.pathname}`,allowLocalHttp);
  // Renewing the same reviewed configuration must not strand existing encrypted
  // credentials. Runtime validity + SQL evidence expiry are checked independently.
  const {clientSecret:ignored,validUntil:ignoredExpiry,evidenceReference:ignoredEvidence,...publicProfile}=config;
  const configHash=sha(canonical(publicProfile));
  const ready=()=>{if(!current())fail(503,'PROVIDER_CONFIGURATION_PENDING');};
  async function request(url,options,max=64000){ready();let response;try{response=await fetchImpl(url,{...options,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{fail(502,'PROVIDER_UNAVAILABLE');}if(!response.ok)fail(502,'PROVIDER_UNAVAILABLE');return max===0?null:boundedJson(response,max);}
  async function token(form){const headers={'content-type':'application/x-www-form-urlencoded','accept':'application/json'};
    form.set('client_id',config.clientId);
    if(config.tokenAuth==='client_secret_basic'){headers.authorization=`Basic ${Buffer.from(config.basicCredentialsEncoding==='RAW'?`${config.clientId}:${config.clientSecret}`:`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64')}`;form.delete('client_id');}
    if(config.tokenAuth==='client_secret_post')form.set('client_secret',config.clientSecret);
    const value=await request(urls.tokenEndpoint,{method:'POST',headers,body:form.toString()});
    if(!object(value)||typeof value.access_token!=='string'||value.access_token.length<1||value.access_token.length>8192
      ||value.token_type?.toLowerCase()!=='bearer'||!(typeof value.expires_in==='number'&&Number.isFinite(value.expires_in)&&value.expires_in>0&&value.expires_in<=31536000)
      ||value.refresh_token!==undefined&&(typeof value.refresh_token!=='string'||value.refresh_token.length<1||value.refresh_token.length>8192))fail(502,'PROVIDER_RESPONSE_INVALID');
    const scopes=value.scope===undefined?config.scopes:typeof value.scope==='string'?value.scope.split(' '):[];
    if(config.scopes.some(s=>!scopes.includes(s))||scopes.some(s=>!config.scopes.includes(s)))fail(502,'PROVIDER_SCOPE_MISMATCH');
    const refreshExpiresAt=typeof value.refresh_token_expires_in==='number'&&Number.isSafeInteger(value.refresh_token_expires_in)&&value.refresh_token_expires_in>0&&value.refresh_token_expires_in<=31536000?new Date(now()+value.refresh_token_expires_in*1000).toISOString():null;
    return {accessToken:value.access_token,refreshToken:value.refresh_token??null,expiresAt:new Date(now()+value.expires_in*1000).toISOString(),refreshExpiresAt,scopes};
  }
  return Object.freeze({configHash,isCurrent:current,allowedDetailFields:Object.freeze([...config.allowedDetailFields]),
    authorizationUrl(state,challenge){ready();const url=new URL(urls.authorizationEndpoint);for(const [k,v] of Object.entries({response_type:'code',client_id:config.clientId,redirect_uri:redirect.href,scope:config.scopes.join(' '),state,code_challenge:challenge,code_challenge_method:'S256'}))url.searchParams.set(k,v);return url.href;},
    async exchange(code,verifier){return token(new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirect.href,code_verifier:verifier}));},
    async subject(credentials){const value=await request(urls.subjectEndpoint,{method:'GET',headers:{authorization:`Bearer ${credentials.accessToken}`,accept:'application/json'}});const subject=value?.[config.subjectField];if(!(typeof subject==='string'&&ID.test(subject)))fail(502,'PROVIDER_RESPONSE_INVALID');return subject;},
    async permissions(credentials){if(!urls.permissionsEndpoint)fail(503,'PROVIDER_CONFIGURATION_PENDING');const value=await request(urls.permissionsEndpoint,{method:'GET',headers:{authorization:`Bearer ${credentials.accessToken}`,accept:'application/json'}});if(!object(value)||!Array.isArray(value.permissions)||value.permissions.length>32||value.permissions.some(p=>typeof p!=='string'||!/^[A-Z_]{1,80}$/.test(p)))fail(502,'PROVIDER_RESPONSE_INVALID');return [...new Set(value.permissions)].sort();},
    async refresh(credentials){if(!credentials.refreshToken)fail(409,'OAUTH_RESTART_REQUIRED');const next=await token(new URLSearchParams({grant_type:'refresh_token',refresh_token:credentials.refreshToken}));return {...next,refreshToken:next.refreshToken??credentials.refreshToken};},
    async revoke(credentials){if(!urls.revocationEndpoint)return false;const form=new URLSearchParams({token:credentials.refreshToken??credentials.accessToken,token_type_hint:credentials.refreshToken?'refresh_token':'access_token',client_id:config.clientId});const headers={'content-type':'application/x-www-form-urlencoded'};
      if(config.tokenAuth==='client_secret_basic'){headers.authorization=`Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64')}`;form.delete('client_id');}
      if(config.tokenAuth==='client_secret_post')form.set('client_secret',config.clientSecret);
      await request(urls.revocationEndpoint,{method:'POST',headers,body:form.toString()},0);return true;},
  });
}
