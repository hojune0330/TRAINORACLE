import {createAccountJournalHandler,createAccountJournalRepository,importJournalAttestor,importJournalKeyring,validateAccountJournalDocument} from '../../supabase/functions/_shared/account-journal-handler.mjs';
import {createAccountPlanCollectionRepository} from '../../supabase/functions/_shared/account-plan-collection-handler.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TABLES=new Set(['account_journal_documents','account_journal_operations']);
const RPCS=new Set(['service_feature_enabled','account_network_access_allowed','mutate_account_journal_attested',
  'account_reward_summary','record_account_reward_visit','list_account_journal_history',
  'read_account_plan_collection_index','read_account_plan_collection_part','read_account_plan_collection_receipt',
  'mutate_account_plan_collection_attested','mutate_account_plan_catalog_replacement_attested','mutate_account_plan_replan_attested']);
const SAFE_CODES=new Set(['22023','42501','23505','P0001','TD001','PZ001','PT409','PZ002','PZ003']);
const unavailable=()=>({data:null,error:{code:'UNAVAILABLE'}});
const response=(status,error)=>Response.json({error},{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
function baseUrl(value,allowLocalHttp){
  let url;try{url=new URL(value);}catch{throw new Error('ACCOUNT_GATEWAY_CONFIGURATION_INVALID');}
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'
    ||url.protocol!=='https:'&&!(allowLocalHttp&&url.protocol==='http:'&&['127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('ACCOUNT_GATEWAY_CONFIGURATION_INVALID');
  return url;
}
function publicKey(value){
  if(typeof value!=='string'||value.length>16384)throw new Error('ACCOUNT_GATEWAY_CONFIGURATION_INVALID');
  if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(value))return value;
  try{const claims=JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString());if(value.split('.').length===3&&claims.role==='anon')return value;}catch{}
  throw new Error('ACCOUNT_GATEWAY_PUBLIC_KEY_REQUIRED');
}
async function bounded(response,max=24_000_000){
  if(!response.body)throw new Error('ACCOUNT_GATEWAY_RESPONSE_INVALID');
  const reader=response.body.getReader(),parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('ACCOUNT_GATEWAY_RESPONSE_INVALID');}parts.push(Buffer.from(value));}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
  }finally{reader.releaseLock();}
}

/** Narrow SDK-compatible transport for the existing repositories only. Every
 * request carries the verified caller JWT and original consent revision. No
 * service role, direct table mutation, generic URL or caller-selected RPC exists. */
export function createAccountRestClient({url,publishableKey,token,storageRevision='',allowLocalHttp=false,fetchImpl=fetch}){
  const base=baseUrl(url,allowLocalHttp),apikey=publicKey(publishableKey);
  async function request(path,body){
    try{
      const result=await fetchImpl(new URL(path,base),{method:body===undefined?'GET':'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
        headers:{apikey,authorization:`Bearer ${token}`,'content-type':'application/json','x-trainoracle-storage-revision':storageRevision},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      const value=await bounded(result);
      return result.ok?{data:value,error:null}:{data:null,error:{code:SAFE_CODES.has(value?.code)?value.code:'UNAVAILABLE'}};
    }catch{return unavailable();}
  }
  function query(table,params=new URLSearchParams(),single=false){
    const next=(key,value)=>{const copy=new URLSearchParams(params);copy.append(key,value);return query(table,copy,single);};
    const column=name=>{if(!/^[a-z_]+$/.test(name))throw new Error('ACCOUNT_GATEWAY_QUERY_INVALID');return name;};
    return {
      select:columns=>{if(!/^[a-z_,]+$/.test(columns))throw new Error('ACCOUNT_GATEWAY_QUERY_INVALID');return next('select',columns);},
      eq:(key,value)=>next(column(key),`eq.${String(value)}`),gt:(key,value)=>next(column(key),`gt.${String(value)}`),
      in:(key,values)=>{if(!Array.isArray(values)||values.length>25||values.some(value=>!UUID.test(value)))throw new Error('ACCOUNT_GATEWAY_QUERY_INVALID');return next(column(key),`in.(${values.join(',')})`);},
      order:(key,{ascending=true}={})=>next('order',`${column(key)}.${ascending?'asc':'desc'}`),
      limit:value=>{if(!Number.isSafeInteger(value)||value<1||value>51)throw new Error('ACCOUNT_GATEWAY_QUERY_INVALID');return next('limit',String(value));},
      maybeSingle:()=>query(table,params,true),
      then(resolve,reject){return request(`/rest/v1/${table}?${params}`).then(result=>{
        if(result.error)return result;if(!Array.isArray(result.data)||single&&result.data.length>1)return unavailable();
        return {data:single?result.data[0]??null:result.data,error:null};
      }).then(resolve,reject);},
    };
  }
  return {
    async getUser(){const result=await request('/auth/v1/user');return result.error?null:result.data;},
    rpc(name,body={}){if(!RPCS.has(name))return Promise.resolve(unavailable());return request(`/rest/v1/rpc/${name}`,body);},
    from(name){if(!TABLES.has(name))throw new Error('ACCOUNT_GATEWAY_QUERY_INVALID');return query(name);},
  };
}

export function createAccountGateway({enabled=false,url,publishableKey,keyringJson,attestationJson,allowedOrigins=[],allowLocalHttp=false,fetchImpl=fetch}={}){
  if(!enabled)return {configured:false,handler:async()=>response(503,'ACCOUNT_GATEWAY_DISABLED')};
  baseUrl(url,allowLocalHttp);publicKey(publishableKey);
  if(typeof keyringJson!=='string'||typeof attestationJson!=='string')throw new Error('ACCOUNT_GATEWAY_CONFIGURATION_INVALID');
  // Values are imported through the existing handlers only; neither configuration
  // nor raw exceptions are returned in health, responses or logs.
  return {configured:true,handler:request=>{
    if(new URL(request.url).pathname!=='/api/account-journal')return response(404,'NOT_FOUND');
    return createAccountJournalHandler({runtimeBudget:'COMPANY_NODE',allowedOrigins,validateDocument:validateAccountJournalDocument,
      getMaterial:async()=>{await importJournalAttestor(attestationJson);return importJournalKeyring(keyringJson);},
      authenticate:async token=>{
        if(token.length>16384)return null;
        const client=createAccountRestClient({url,publishableKey,token,storageRevision:request.headers.get('x-trainoracle-storage-revision')??'',allowLocalHttp,fetchImpl});
        const user=await client.getUser();let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{return null;}
        if(!UUID.test(user?.id??'')||claims.sub!==user.id||claims.role!=='authenticated'||!UUID.test(claims.session_id??'')||!Number.isSafeInteger(claims.exp)||claims.exp*1000<=Date.now())return null;
        const attest=async(ownerId,action,input)=>(await importJournalAttestor(attestationJson))(ownerId,action,input);
        return {ownerId:user.id,repo:{...createAccountJournalRepository(client,{ownerId:user.id,attest}),
          planCollection:createAccountPlanCollectionRepository(client,{ownerId:user.id,attest})}};
      },
    })(request);
  }};
}

export function accountGatewayFromEnvironment(env=process.env){return createAccountGateway({enabled:env.TRAINORACLE_ACCOUNT_GATEWAY_ENABLED==='true',
  url:env.SUPABASE_URL,publishableKey:env.SUPABASE_ANON_KEY,keyringJson:env.TRAINORACLE_JOURNAL_KEYRING_JSON,
  attestationJson:env.TRAINORACLE_JOURNAL_ATTESTATION_JSON,
  allowedOrigins:(env.TRAINORACLE_JOURNAL_ALLOWED_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean)});}
