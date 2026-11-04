import {inCidrs} from '../garmin-integration/delivery-source.mjs';
import {INGRESS_VERSION,INGRESS_HEADERS,IngressError,deny,unavailable,requireConfig,keyFromHex,hex,sourceIpv4,exactIngressUrl,requireIngressRequest,clientIdHeader,signatureText,safeHeaders,ingressResponse,boundedBody} from './protocol.mjs';

/** Direct Garmin -> Cloudflare only. A Worker subrequest can alter client IP
 * headers; CF-Worker is platform-added to fetch subrequests and is rejected.
 * Do not mount behind another CDN, Worker or a service binding. See README. */
export function createGarminIngressWorker({keyId,audience,secretHex,publicUrl,originUrl},{fetchImpl=fetch,cryptoImpl=crypto,now=()=>Date.now()}={}){
  requireConfig({keyId,audience,secretHex});publicUrl=exactIngressUrl(publicUrl);originUrl=exactIngressUrl(originUrl);
  if(new URL(publicUrl).origin===new URL(originUrl).origin)unavailable();
  const rawKey=keyFromHex(secretHex);
  const keyPromise=cryptoImpl.subtle.importKey('raw',rawKey,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  rawKey.fill(0);
  return Object.freeze({async fetch(request){
    try{
      requireIngressRequest(request);if(request.url!==publicUrl)deny();
      // request.cf is runtime metadata, not a header. Tests explicitly supply a
      // synthetic marker; a normal Request outside Cloudflare fails closed.
      if(!request.cf||typeof request.cf!=='object'||typeof request.cf.colo!=='string'||!request.cf.colo)deny();
      if(request.headers.has('cf-worker')||request.headers.has('x-real-ip'))deny();
      const sourceIp=sourceIpv4(request.headers.get('cf-connecting-ip'));if(!inCidrs(sourceIp))deny();
      const clientId=clientIdHeader(request),body=await boundedBody(request);
      const nonce=hex(cryptoImpl.getRandomValues(new Uint8Array(16))),timestamp=String(Math.floor(now()/1000));
      const bodySha256=hex(await cryptoImpl.subtle.digest('SHA-256',body));
      const fields={keyId,audience,timestamp,nonce,sourceIp,bodySha256,clientId};
      const signature=hex(await cryptoImpl.subtle.sign('HMAC',await keyPromise,new TextEncoder().encode(signatureText(fields))));
      // Never forward caller authorization/cookies/forwarding/signature headers.
      const headers=safeHeaders(clientId);headers.set(INGRESS_HEADERS.version,INGRESS_VERSION);
      for(const name of ['keyId','audience','timestamp','nonce','sourceIp','bodySha256'])headers.set(INGRESS_HEADERS[name],fields[name]);
      headers.set(INGRESS_HEADERS.signature,signature);
      const response=await fetchImpl(originUrl,{method:'POST',headers,body,redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000)});
      // ACK only the existing durable ingress handler's 200; do not reflect an
      // origin body, headers, redirects, errors or credentials to the sender.
      if(response.body)void response.body.cancel().catch(()=>{});
      if(response.status!==200)return ingressResponse([400,403,409,413,415,422,429].includes(response.status)?response.status:503,{error:'INGRESS_UNAVAILABLE'});
      return ingressResponse(200,{accepted:true});
    }catch(error){return ingressResponse(error instanceof IngressError?error.status:503,{error:error instanceof IngressError?error.code:'INGRESS_UNAVAILABLE'});}
  }});
}

// Environment objects are stable per deployment in Workers. No credentials are
// written to logs, requests, storage or generated configuration.
const workers=new WeakMap();
export default {async fetch(request,env){
  try{
    let worker=workers.get(env);if(!worker){worker=createGarminIngressWorker({
      keyId:env.TRAINORACLE_GARMIN_INGRESS_KEY_ID,audience:env.TRAINORACLE_GARMIN_INGRESS_AUDIENCE,
      secretHex:env.TRAINORACLE_GARMIN_INGRESS_SECRET_HEX,publicUrl:env.TRAINORACLE_GARMIN_INGRESS_PUBLIC_URL,originUrl:env.TRAINORACLE_GARMIN_INGRESS_ORIGIN_URL,
    });workers.set(env,worker);}return await worker.fetch(request);
  }catch{return ingressResponse(503,{error:'INGRESS_CONFIGURATION_PENDING'});}
}};
