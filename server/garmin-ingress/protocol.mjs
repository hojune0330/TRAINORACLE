// Small, dependency-free protocol shared by Cloudflare Workers and Node.
export const INGRESS_VERSION='TRAINORACLE_GARMIN_INGRESS_V1';
export const INGRESS_MODE='CLOUDFLARE_SIGNED_V1';
export const INGRESS_PATH='/webhooks/garmin';
export const INGRESS_BODY_MAX_BYTES=6_500_000;
export const INGRESS_MAX_AGE_SECONDS=120;
export const INGRESS_FUTURE_SKEW_SECONDS=10;
export const INGRESS_HEADERS=Object.freeze({
  version:'x-trainoracle-ingress-version',keyId:'x-trainoracle-ingress-key-id',
  audience:'x-trainoracle-ingress-audience',timestamp:'x-trainoracle-ingress-timestamp',
  nonce:'x-trainoracle-ingress-nonce',sourceIp:'x-trainoracle-ingress-source-ip',
  bodySha256:'x-trainoracle-ingress-body-sha256',signature:'x-trainoracle-ingress-signature',
});
export class IngressError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}}
export const deny=()=>{throw new IngressError(403,'INGRESS_ACCESS_DENIED');};
export const unavailable=()=>{throw new IngressError(503,'INGRESS_UNAVAILABLE');};
export const validId=value=>typeof value==='string'&&/^[A-Za-z0-9._-]{1,80}$/.test(value);
export const validHex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const hex=bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
export function keyFromHex(value){if(!validHex(value))unavailable();return Uint8Array.from(value.match(/../g),pair=>parseInt(pair,16));}
export function requireConfig({keyId,audience,secretHex}){if(!validId(keyId)||!validId(audience)||!validHex(secretHex))unavailable();}
export function sourceIpv4(value){
  if(typeof value!=='string'||!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value))deny();
  if(value.split('.').some(part=>Number(part)>255||String(Number(part))!==part))deny();
  return value;
}
export function exactIngressUrl(raw){
  let url;try{url=new URL(raw);}catch{unavailable();}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!==INGRESS_PATH||url.href!==raw)unavailable();
  return url.href;
}
export function requireIngressRequest(request){
  const url=new URL(request.url);
  if(request.method!=='POST'||url.pathname!==INGRESS_PATH||url.search||url.hash)deny();
  const type=request.headers.get('content-type')??'';
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type))throw new IngressError(415,'INGRESS_CONTENT_TYPE_UNSUPPORTED');
  if(request.headers.has('content-encoding')&&request.headers.get('content-encoding')!=='identity')throw new IngressError(415,'INGRESS_CONTENT_ENCODING_UNSUPPORTED');
  if(request.headers.has('origin'))deny();
}
export function clientIdHeader(request){
  const id=request.headers.get('garmin-client-id')??'';
  if(id!==''&&!/^[A-Za-z0-9._:-]{1,200}$/.test(id))deny();
  return id;
}
export function signatureText(fields){
  return [INGRESS_VERSION,fields.keyId,fields.audience,'POST',INGRESS_PATH,fields.timestamp,fields.nonce,fields.sourceIp,fields.bodySha256,fields.clientId].join('\n');
}
export function safeHeaders(clientId){
  const headers=new Headers({'content-type':'application/json'});
  if(clientId)headers.set('garmin-client-id',clientId);
  return headers;
}
export function ingressResponse(status,value){return Response.json(value,{status,headers:{'cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}
export async function boundedBody(request){
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^(?:0|[1-9]\d{0,9})$/.test(length)||Number(length)>INGRESS_BODY_MAX_BYTES))throw new IngressError(413,'INGRESS_TOO_LARGE');
  const reader=request.body?.getReader();if(!reader)throw new IngressError(422,'INGRESS_BODY_REQUIRED');
  const chunks=[];let size=0;
  try{
    while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;
      if(size>INGRESS_BODY_MAX_BYTES){void reader.cancel().catch(()=>{});throw new IngressError(413,'INGRESS_TOO_LARGE');}
      chunks.push(chunk.value);
    }
    if(!size||length!==null&&size!==Number(length))throw new IngressError(422,'INGRESS_BODY_INVALID');
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
  }catch(error){if(error instanceof IngressError)throw error;throw new IngressError(422,'INGRESS_BODY_INVALID');}
  finally{reader.releaseLock();}
}
