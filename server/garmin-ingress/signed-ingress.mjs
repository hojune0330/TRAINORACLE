import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {inCidrs} from '../garmin-integration/delivery-source.mjs';
import {INGRESS_MODE,INGRESS_VERSION,INGRESS_PATH,INGRESS_HEADERS,INGRESS_MAX_AGE_SECONDS,INGRESS_FUTURE_SKEW_SECONDS,IngressError,deny,unavailable,requireConfig,keyFromHex,validHex,sourceIpv4,requireIngressRequest,clientIdHeader,signatureText,safeHeaders,ingressResponse,boundedBody} from './protocol.mjs';

const sameHex=(a,b)=>validHex(a)&&validHex(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
/** Process-local bounded replay defense. Claim is synchronous after verification
 * and before awaiting the handler. Capacity exhaustion rejects new requests;
 * it never evicts live entries to admit a replay. Existing durable queue IDs
 * remain the restart/multiple-instance idempotency boundary. */
export function createIngressReplayCache({maxEntries=10000}={}){
  if(!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>100000)unavailable();
  const entries=new Map();
  return Object.freeze({claim(nonce,expiresAt,nowSeconds){
    for(const [key,expiry] of entries)if(expiry<nowSeconds)entries.delete(key);
    if(entries.has(nonce))throw new IngressError(409,'INGRESS_REPLAY');
    if(entries.size>=maxEntries)throw new IngressError(503,'INGRESS_REPLAY_CAPACITY');
    entries.set(nonce,expiresAt);
  }});
}

export function createSignedGarminIngress(handler,{keyId,audience,secretHex,now=()=>Date.now(),replayCache=createIngressReplayCache()}={}){
  requireConfig({keyId,audience,secretHex});if(typeof handler!=='function'||typeof replayCache?.claim!=='function')unavailable();
  const key=keyFromHex(secretHex);
  return async(request,transport={})=>{
    if(new URL(request.url).pathname!==INGRESS_PATH)return handler(request,transport);
    try{
      requireIngressRequest(request);
      const fields=Object.fromEntries(Object.entries(INGRESS_HEADERS).map(([name,header])=>[name,request.headers.get(header)]));
      if(fields.version!==INGRESS_VERSION||fields.keyId!==keyId||fields.audience!==audience
        ||!/^\d{10}$/.test(fields.timestamp??'')||!validHex(fields.bodySha256)||!validHex(fields.signature)
        ||!/^[a-f0-9]{32}$/.test(fields.nonce??''))deny();
      fields.sourceIp=sourceIpv4(fields.sourceIp);if(!inCidrs(fields.sourceIp))deny();
      fields.clientId=clientIdHeader(request);
      const signedAt=Number(fields.timestamp),at=Math.floor(now()/1000);
      if(signedAt<at-INGRESS_MAX_AGE_SECONDS||signedAt>at+INGRESS_FUTURE_SKEW_SECONDS)deny();
      // Verify HMAC before reading an untrusted potentially large request body.
      if(!sameHex(fields.signature,createHmac('sha256',key).update(signatureText(fields)).digest('hex')))deny();
      const body=await boundedBody(request);
      if(!sameHex(fields.bodySha256,createHash('sha256').update(body).digest('hex')))deny();
      const checkedAt=Math.floor(now()/1000);
      if(signedAt<checkedAt-INGRESS_MAX_AGE_SECONDS||signedAt>checkedAt+INGRESS_FUTURE_SKEW_SECONDS)deny();
      replayCache.claim(`${keyId}:${fields.nonce}`,signedAt+INGRESS_MAX_AGE_SECONDS,checkedAt);
      // Only the signed source address crosses this boundary. All caller proxy
      // headers are discarded so legacy trusted-proxy configuration cannot
      // reinterpret unsigned input. Existing Garmin CIDR/client-ID checks run too.
      const verified=new Request(request.url,{method:'POST',headers:safeHeaders(fields.clientId),body,signal:request.signal});
      return await handler(verified,{...transport,peerAddress:fields.sourceIp});
    }catch(error){return ingressResponse(error instanceof IngressError?error.status:503,{error:error instanceof IngressError?error.code:'INGRESS_UNAVAILABLE'});}
  };
}

export function signedGarminIngressFromEnvironment(handler,env=process.env){
  const mode=env.TRAINORACLE_GARMIN_INGRESS_MODE;
  if(mode===undefined||mode==='DIRECT')return handler;
  if(mode!==INGRESS_MODE)unavailable();
  return createSignedGarminIngress(handler,{keyId:env.TRAINORACLE_GARMIN_INGRESS_KEY_ID,audience:env.TRAINORACLE_GARMIN_INGRESS_AUDIENCE,secretHex:env.TRAINORACLE_GARMIN_INGRESS_SECRET_HEX});
}
