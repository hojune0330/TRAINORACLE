import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const VERSION = 'GARMIN_INTEGRATION_V1';
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f0-9][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const ID = /^[A-Za-z0-9._:-]{1,200}$/;
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const exact = (value, allowed, required = allowed) => object(value) && Object.keys(value).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(value, k));
export class IntegrationError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
export const fail = (status, code) => { throw new IntegrationError(status, code); };
export const sha = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  fail(422, 'INVALID_INPUT');
}
export function stableUuid(parts) { const b = createHash('sha256').update(canonical(parts)).digest().subarray(0,16); b[6] = (b[6]&15)|80; b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; }
export const nonce = () => randomBytes(32).toString('base64url');
export async function boundedJson(response, max=128_000) {
  const reader=response.body?.getReader(); if(!reader) fail(422,'INVALID_INPUT');
  let length=0;const chunks=[];
  try { while(true) { const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>max) {await reader.cancel();fail(413,'TOO_LARGE');}chunks.push(Buffer.from(part.value)); }
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  } catch(error) { if(error instanceof IntegrationError)throw error;fail(422,'INVALID_INPUT'); }
}
export function trustedUrl(raw, allowLocalHttp=false) {
  let url;try{url=new URL(raw);}catch{fail(503,'CONFIGURATION_INVALID');}
  if(url.username||url.password||url.hash||url.search || !(url.protocol==='https:' || allowLocalHttp && url.protocol==='http:' && url.hostname==='127.0.0.1')) fail(503,'CONFIGURATION_INVALID');
  return url;
}
export function keyBytes(encoded) { if(typeof encoded!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))fail(503,'KEY_UNAVAILABLE');const b=Buffer.from(encoded,'base64');if(b.length!==32||b.toString('base64')!==encoded)fail(503,'KEY_UNAVAILABLE');return b; }
export function sign(secret, text) { return createHmac('sha256',secret).update(text).digest('hex'); }
export function sameSignature(a,b) { return /^[a-f0-9]{64}$/.test(a??'')&&/^[a-f0-9]{64}$/.test(b??'')&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex')); }

/** A separate keyring from account-journal encryption. Every payload is bound to owner,
 * connection, connection epoch, record/revision and purpose. No raw-token persistence. */
export async function createVault(config) {
  if(!exact(config,['activeKeyId','keys'])||!ID.test(config.activeKeyId)||!object(config.keys)||Object.keys(config.keys).length>8)fail(503,'KEY_UNAVAILABLE');
  const keys=new Map();
  for(const [id,value] of Object.entries(config.keys)) {if(!ID.test(id))fail(503,'KEY_UNAVAILABLE');const bytes=keyBytes(value);try{keys.set(id,await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']));}finally{bytes.fill(0);}}
  if(!keys.has(config.activeKeyId))fail(503,'KEY_UNAVAILABLE');
  const aad=(context,keyId)=>new TextEncoder().encode(canonical(['trainoracle.garmin.v1',context,keyId]));
  return {
    async seal(value,context) { const bytes=Buffer.from(canonical(value));if(bytes.length>256_000)fail(413,'TOO_LARGE');const iv=randomBytes(12);const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(context,config.activeKeyId)},keys.get(config.activeKeyId),bytes);return {version:1,keyId:config.activeKeyId,iv:iv.toString('base64'),ciphertext:Buffer.from(cipher).toString('base64')}; },
    async open(payload,context) { try {if(!exact(payload,['version','keyId','iv','ciphertext'])||payload.version!==1||!keys.has(payload.keyId)||payload.ciphertext.length>350_000)throw 0;const iv=Buffer.from(payload.iv,'base64'),cipher=Buffer.from(payload.ciphertext,'base64');if(iv.length!==12||iv.toString('base64')!==payload.iv||cipher.length<16||cipher.toString('base64')!==payload.ciphertext)throw 0;return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(context,payload.keyId)},keys.get(payload.keyId),cipher))); }catch{fail(503,'ENCRYPTED_DATA_UNAVAILABLE');} },
  };
}

const numberOrNull=v=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0;
function validTimestamp(value) {
  if(typeof value!=='string')return false;
  const match=/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if(!match||match[7]==='-00:00')return false;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const days=month===2?((year%4===0&&year%100!==0)||year%400===0?29:28):[4,6,9,11].includes(month)?30:31;
  return month>=1&&month<=12&&day>=1&&day<=days&&Number.isFinite(Date.parse(value));
}
export function prepareObservation(input) {
  const fields=['provider','sourceId','sourceVersion','sport','startedAt','timeZone','distanceMeters','durationSeconds','durationMeaning','laps'];
  if(!exact(input,fields)||input.provider!=='GARMIN'||!ID.test(input.sourceId)||!(input.sourceVersion===null||typeof input.sourceVersion==='string'&&input.sourceVersion.length<=100)
    ||!['RUNNING','WALKING','CYCLING','OTHER','UNKNOWN'].includes(input.sport)||!validTimestamp(input.startedAt)||typeof input.timeZone!=='string'||input.timeZone.length<1||input.timeZone.length>100
    ||!numberOrNull(input.distanceMeters)||!numberOrNull(input.durationSeconds)||!['TIMER','MOVING','ELAPSED','UNKNOWN'].includes(input.durationMeaning)
    ||!Array.isArray(input.laps)||input.laps.length>1000)fail(422,'INVALID_OBSERVATION');
  try{new Intl.DateTimeFormat('en',{timeZone:input.timeZone}).format();}catch{fail(422,'INVALID_OBSERVATION');}
  for(const lap of input.laps)if(!exact(lap,['distanceMeters','durationSeconds','durationMeaning'])||!numberOrNull(lap.distanceMeters)||!numberOrNull(lap.durationSeconds)||!['TIMER','MOVING','ELAPSED','UNKNOWN'].includes(lap.durationMeaning))fail(422,'INVALID_OBSERVATION');
  const sourceId=`garmin:${sha(input.sourceId)}`;
  return {...input,schemaVersion:'PREPARED_DEVICE_ACTIVITY_V1',analysisEligible:false,dataLineage:{schemaVersion:'PROVIDER_DATA_LINEAGE_V1',sources:[{sourceId,originProvider:'GARMIN',transport:'PROVIDER_API',assurance:'PROVIDER_VERIFIED'}],fieldSources:Object.fromEntries(['sport','startedAt','timeZone','distanceMeters','durationSeconds','durationMeaning','laps'].map(k=>[k,[sourceId]]))}};
}

/** Optional normalized detail. Raw JSON, notes, tokens and vendor fields cannot enter.
 * The reviewed profile must explicitly permit each sensor family, including route. */
export function prepareDetail(input,allowedFields) {
  if(input===null||input===undefined)return [];
  if(!Array.isArray(input)||input.length>100_000)fail(422,'INVALID_DETAIL');
  const fields=['offsetSeconds','heartRateBpm','powerWatts','cadenceSpm','speedMetersPerSecond','altitudeMeters','latitude','longitude','timerSeconds','clockSeconds','movingSeconds','totalDistanceMeters','bikeCadenceRpm','swimCadenceSpm','airTemperatureCelsius'];
  let last=-1;
  for(const sample of input) {
    if(!exact(sample,fields,['offsetSeconds'])||typeof sample.offsetSeconds!=='number'||!Number.isFinite(sample.offsetSeconds)||sample.offsetSeconds<last||sample.offsetSeconds<0)fail(422,'INVALID_DETAIL');last=sample.offsetSeconds;
    for(const [key,value] of Object.entries(sample)){if(key==='offsetSeconds')continue;if(!allowedFields.includes(key)||!(value===null||typeof value==='number'&&Number.isFinite(value)))fail(422,'DETAIL_PERMISSION_REQUIRED');if(value!==null&&((key==='latitude'&&Math.abs(value)>90)||(key==='longitude'&&Math.abs(value)>180)||(!['latitude','longitude','altitudeMeters','airTemperatureCelsius'].includes(key)&&value<0)))fail(422,'INVALID_DETAIL');}
    if(sample.movingSeconds!=null&&sample.timerSeconds!=null&&sample.movingSeconds>sample.timerSeconds||sample.timerSeconds!=null&&sample.clockSeconds!=null&&sample.timerSeconds>sample.clockSeconds)fail(422,'INVALID_DETAIL');
  }
  const parts=[];let part=[],size=2;
  for(const sample of input){const n=Buffer.byteLength(canonical(sample))+1;if(size+n>190_000){parts.push(part);part=[];size=2;}part.push(sample);size+=n;}
  if(part.length)parts.push(part);if(parts.length>32)fail(413,'TOO_LARGE');return parts;
}
