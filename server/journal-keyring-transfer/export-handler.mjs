import {SECRET_NAME,exact,encoded,unbase64,sha256,validatePins,validateKeyring,checkWindow,sealKeyring,fail} from './protocol.mjs';
const response=(status,value)=>Response.json(value,{status,headers:{'cache-control':'no-store','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
export function createSealedExportHandler({config,readKeyring,now=()=>Date.now()}){
  if(!exact(config,['mode','pins','recipientSpkiBase64','authorizationSha256'])||!['FINGERPRINT_ONLY','SEALED_EXPORT'].includes(config.mode)||typeof readKeyring!=='function'
    ||! /^[a-f0-9]{64}$/.test(config.authorizationSha256)||typeof config.recipientSpkiBase64!=='string')fail();
  const fingerprintOnly=config.mode==='FINGERPRINT_ONLY';
  if(fingerprintOnly&&config.pins?.keyringSha256!==null)fail();
  const pins=validatePins(fingerprintOnly?{...config.pins,keyringSha256:'0'.repeat(64)}:config.pins),recipient=config.recipientSpkiBase64,authorizationSha256=config.authorizationSha256;
  return async request=>{
    try{
      checkWindow(pins,Math.floor(now()/1000));
      const url=new URL(request.url);
      // Supabase may strip /functions/v1 before forwarding to the isolate.
      if(!['/functions/v1/journal-keyring-sealed-migration','/journal-keyring-sealed-migration'].includes(url.pathname)||url.search||url.hash||request.method!=='POST'
        ||request.headers.has('origin')||request.headers.has('cookie'))return response(403,{error:'MIGRATION_DENIED'});
      const token=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization')??'')?.[1];
      if(!token||await sha256(token)!==authorizationSha256)return response(403,{error:'MIGRATION_DENIED'});
      if(request.headers.get('content-type')!=='application/json'||request.headers.has('content-encoding'))return response(415,{error:'MIGRATION_DENIED'});
      const length=request.headers.get('content-length');if(length!==null&&length!=='2')return response(413,{error:'MIGRATION_DENIED'});
      const reader=request.body?.getReader();if(!reader)return response(422,{error:'MIGRATION_DENIED'});
      let body='';try{while(true){const chunk=await reader.read();if(chunk.done)break;
        if(encoded(body).length+chunk.value.byteLength>2){void reader.cancel().catch(()=>{});return response(413,{error:'MIGRATION_DENIED'});}
        body+=new TextDecoder('utf-8',{fatal:true}).decode(chunk.value);}}finally{reader.releaseLock();}
      if(body!=='{}')return response(422,{error:'MIGRATION_DENIED'});
      checkWindow(pins,Math.floor(now()/1000));
      if(await sha256(unbase64(recipient,1024))!==pins.recipientSha256)fail();
      // This callback has no caller-controlled secret name or destination.
      const raw=readKeyring(SECRET_NAME);
      if(fingerprintOnly){
        validateKeyring(raw);const rawSha256=await sha256(raw);checkWindow(pins,Math.floor(now()/1000));
        return response(200,{schemaVersion:'TRAINORACLE_JOURNAL_FINGERPRINT_V1',rawSha256});
      }
      const envelope=await sealKeyring(raw,pins,recipient,Math.floor(now()/1000));
      checkWindow(pins,Math.floor(now()/1000));
      return response(200,envelope);
    }catch{return response(503,{error:'MIGRATION_UNAVAILABLE'});}
  };
}
