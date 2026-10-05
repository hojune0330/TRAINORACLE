import { decryptAccountJournalDocument } from './account-journal-crypto.mjs';
import { accountPlanCollectionDocumentId } from './account-plan-collection-handler.mjs';

const collections = new Set(['journal','history','planParts','planIndex','legacyJournal','legacyPlans',
  'legacyPrivateNotes','providerActivities','providerDaily']);
const uuid = value => typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value);
// No save/restore/mutation, provider call, analytics or logging is permitted here.
export function createAccountDataRightsHandler({ authenticate, getMaterial, allowedOrigins=[] }) {
  return async request => {
    const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff','Vary':'Origin'});
    const response=(status,value)=>new Response(value===null?null:JSON.stringify(value),{status,headers});
    try {
      const origin=request.headers.get('origin');
      if(origin && !allowedOrigins.includes(origin)) return response(403,{error:'ACCESS_DENIED'});
      if(origin) headers.set('Access-Control-Allow-Origin',origin);
      if(request.method==='OPTIONS') {
        const requested=(request.headers.get('access-control-request-headers')??'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
        if(!origin || request.headers.get('access-control-request-method')!=='POST'
          || requested.some(v=>!['authorization','apikey','content-type','x-client-info'].includes(v))) return response(403,{error:'ACCESS_DENIED'});
        headers.set('Access-Control-Allow-Methods','POST');
        headers.set('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info');
        return response(204,null);
      }
      if(request.method!=='POST') return response(405,{error:'METHOD_NOT_ALLOWED'});
      if(!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type')??'')) return response(415,{error:'INVALID_REQUEST'});
      const token=/^Bearer ([^\s]+)$/iu.exec(request.headers.get('authorization')??'')?.[1];
      const session=token ? await authenticate(token) : null;
      if(!uuid(session?.ownerId)) return response(401,{error:'AUTH_REQUIRED'});
      // Bound the body before parsing; only identifiers/cursors are accepted.
      const reader=request.body?.getReader(); if(!reader) return response(400,{error:'INVALID_REQUEST'});
      const chunks=[]; let length=0;
      try {
        while(true) { const part=await reader.read(); if(part.done) break;
          length+=part.value.byteLength;
          if(length>4096) { await reader.cancel(); return response(413,{error:'BODY_TOO_LARGE'}); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      const bytes=new Uint8Array(length); let offset=0;
      for(const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
      const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if(!input || Object.keys(input).sort().join(',')!=='collection,cursor,expectedSessionId,expectedUserId'
        || input.expectedUserId!==session.ownerId || !uuid(input.expectedSessionId)
        || !collections.has(input.collection) || typeof input.cursor!=='string' || input.cursor.length>1200) return response(400,{error:'INVALID_REQUEST'});
      const page=await session.read(input);
      if(page?.ownerId!==session.ownerId || page.collection!==input.collection || !Array.isArray(page.items)
        || page.items.length>10 || page.items.some(item=>item.record?.user_id!==session.ownerId)) return response(403,{error:'ACCESS_DENIED'});
      let material;
      for(const item of page.items) {
        const row=item.record;
        const encrypted=['journal','history'].includes(input.collection) ? row.encrypted_payload
          : ['planParts','planIndex'].includes(input.collection) ? row.payload : null;
        if(!encrypted) continue;
        material??=await getMaterial();
        const documentId=['journal','history'].includes(input.collection) ? row.document_id
          : input.collection==='planIndex'
            ? await accountPlanCollectionDocumentId(session.ownerId,'PLAN_COLLECTION','index')
            : await accountPlanCollectionDocumentId(session.ownerId,row.part_kind,row.part_id);
        const text=await decryptAccountJournalDocument(encrypted,{ownerId:session.ownerId,documentId},material.get(encrypted.keyId));
        // Explicit export only. Never feed the result into application state or AI.
        row.document=JSON.parse(text);
        delete row.encrypted_payload; delete row.payload;
      }
      // Recheck the same active session after decryption and before releasing any data.
      if(await session.verify(input)!==true) return response(403,{error:'ACCESS_DENIED'});
      return response(200,page);
    } catch { return response(503,{error:'DATA_RIGHTS_UNAVAILABLE'}); }
  };
}
