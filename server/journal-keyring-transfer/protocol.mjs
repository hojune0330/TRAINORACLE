// Portable Web Crypto only: the Edge exporter never imports Node dependencies.
export const VERSION='TRAINORACLE_JOURNAL_SEALED_V1';
export const SECRET_NAME='TRAINORACLE_JOURNAL_KEYRING_JSON';
export const MAX_KEYRING_BYTES=49152;
export const MAX_ENVELOPE_BYTES=72000;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const fields=['schemaVersion','secretName','sourceProjectRef','destinationServiceId','migrationId','validFrom','expiresAt','recipientSha256','keyringSha256'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const exact=(value,names)=>object(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
export const fail=()=>{throw new Error('JOURNAL_SEALED_MIGRATION_INVALID');};
export const encoded=value=>encoder.encode(value);
export function base64(bytes){let text='';for(const byte of new Uint8Array(bytes))text+=String.fromCharCode(byte);return btoa(text);}
export function unbase64(value,max){
  if(typeof value!=='string'||value.length>Math.ceil(max/3)*4||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))fail();
  let bytes;try{bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{fail();}
  if(bytes.length>max||base64(bytes)!==value)fail();return bytes;
}
export async function sha256(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoded(value):value)),b=>b.toString(16).padStart(2,'0')).join('');}
export function validatePins(value){
  if(!exact(value,fields)||value.schemaVersion!==VERSION||value.secretName!==SECRET_NAME
    ||! /^[a-z0-9]{20}$/.test(value.sourceProjectRef)||!/^srv-[a-z0-9]{10,60}$/.test(value.destinationServiceId)
    ||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.migrationId)
    ||!Number.isSafeInteger(value.validFrom)||!Number.isSafeInteger(value.expiresAt)||value.validFrom<0
    ||value.expiresAt<=value.validFrom||value.expiresAt-value.validFrom>900
    ||! /^[a-f0-9]{64}$/.test(value.recipientSha256)||! /^[a-f0-9]{64}$/.test(value.keyringSha256))fail();
  return Object.freeze(Object.fromEntries(fields.map(name=>[name,value[name]])));
}
export function checkWindow(pins,at){if(!Number.isSafeInteger(at)||at<pins.validFrom||at>=pins.expiresAt)fail();}
const aad=(pins,sealedAt)=>encoded(JSON.stringify([...fields.map(name=>pins[name]),sealedAt]));
export function validateKeyring(raw){
  if(typeof raw!=='string'||encoded(raw).length>MAX_KEYRING_BYTES)fail();
  let value;try{value=JSON.parse(raw);}catch{fail();}
  if(!exact(value,['activeKeyId','keys'])||typeof value.activeKeyId!=='string'||!object(value.keys)
    ||!Object.hasOwn(value.keys,value.activeKeyId)||Object.keys(value.keys).length===0)fail();
  for(const [id,text]of Object.entries(value.keys)){
    if(!id.trim()||id.length>80||typeof text!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(text))fail();
    const bytes=unbase64(text,32);try{if(bytes.length!==32)fail();}finally{bytes.fill(0);}
  }
  // Preserve the exact original bytes: whitespace and all historical key IDs.
  return raw;
}
export async function sealKeyring(raw,pinsInput,recipientSpkiBase64,sealedAt){
  const pins=validatePins(pinsInput);checkWindow(pins,sealedAt);validateKeyring(raw);
  if(await sha256(raw)!==pins.keyringSha256)fail();
  const spki=unbase64(recipientSpkiBase64,1024);if(await sha256(spki)!==pins.recipientSha256)fail();
  const recipient=await crypto.subtle.importKey('spki',spki,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  if(recipient.algorithm.modulusLength!==3072||base64(recipient.algorithm.publicExponent)!=='AQAB')fail();
  const material=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12)),plaintext=encoded(raw),binding=aad(pins,sealedAt);
  try{
    const key=await crypto.subtle.importKey('raw',material,'AES-GCM',false,['encrypt']);
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:binding,tagLength:128},key,plaintext);
    const wrappedKey=await crypto.subtle.encrypt({name:'RSA-OAEP',label:binding},recipient,material);
    return {metadata:pins,sealedAt,wrappedKey:base64(wrappedKey),iv:base64(iv),ciphertext:base64(ciphertext)};
  }finally{material.fill(0);plaintext.fill(0);}
}
/** Durable startup artifact, not an HTTP importer. Its exact serialized digest
 * is operator-pinned. Issuance must be in the migration window; restart does not
 * revoke an already approved artifact merely because that window has elapsed. */
export async function openPinnedEnvelope(serialized,pinsInput,expectedEnvelopeSha256,recipientPkcs8Base64){
  try{
    const pins=validatePins(pinsInput);
    if(typeof serialized!=='string'||encoded(serialized).length>MAX_ENVELOPE_BYTES
      ||! /^[a-f0-9]{64}$/.test(expectedEnvelopeSha256)||await sha256(serialized)!==expectedEnvelopeSha256)fail();
    const value=JSON.parse(serialized);
    if(!exact(value,['metadata','sealedAt','wrappedKey','iv','ciphertext']))fail();
    const metadata=validatePins(value.metadata);
    if(fields.some(name=>metadata[name]!==pins[name]))fail();checkWindow(pins,value.sealedAt);
    const pkcs8=unbase64(recipientPkcs8Base64,4096);let privateKey;
    try{privateKey=await crypto.subtle.importKey('pkcs8',pkcs8,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);}finally{pkcs8.fill(0);}
    if(privateKey.algorithm.modulusLength!==3072||base64(privateKey.algorithm.publicExponent)!=='AQAB')fail();
    const binding=aad(metadata,value.sealedAt),wrapped=unbase64(value.wrappedKey,384),iv=unbase64(value.iv,12),ciphertext=unbase64(value.ciphertext,MAX_KEYRING_BYTES+16);
    if(wrapped.length!==384||iv.length!==12||ciphertext.length<16)fail();
    const material=new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP',label:binding},privateKey,wrapped));let key;
    try{if(material.length!==32)fail();key=await crypto.subtle.importKey('raw',material,'AES-GCM',false,['decrypt']);}finally{material.fill(0);}
    const plaintext=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:binding,tagLength:128},key,ciphertext));
    try{if(await sha256(plaintext)!==pins.keyringSha256)fail();return validateKeyring(decoder.decode(plaintext));}finally{plaintext.fill(0);}
  }catch{fail();}
}
