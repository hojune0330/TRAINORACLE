import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhoopOAuth, WhoopOAuthError } from '../functions/_shared/whoop-oauth.mjs';

// Synthetic fixtures only. No real WHOOP request, credential, or health data.
const URI='https://trainoracle.example/oauth/whoop';
const A={accountId:'account-a',sessionBinding:'synthetic-session',redirectUri:URI};
const json = (body, options={}) => new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'},...options});
const payload = (offline=false,n=1) => ({access_token:`synthetic-access-${n}`,token_type:'bearer',expires_in:3600,scope:offline?'read:workout offline':'read:workout',...(offline?{refresh_token:`synthetic-refresh-${n}`}:{})});
function fixture(options={}) {
  const states=new Map(), rows=new Map(), tails=new Map(), calls=[];
  let clock=1_800_000_000_000; let count=0;
  const check=signal=>{if(signal.aborted) throw Error('synthetic aborted');};
  const store={
    async putState({stateHash,record,signal}) {check(signal);if(states.has(stateHash))return false;states.set(stateHash,structuredClone(record));return true;},
    async consumeState({stateHash,accountId,bindingHash,redirectUri,now,signal}) {
      check(signal);const r=states.get(stateHash);
      if(!r||r.accountId!==accountId||r.bindingHash!==bindingHash||r.redirectUri!==redirectUri||r.expiresAt<=now)return null;
      states.delete(stateHash);return structuredClone(r);
    },
    async withAccountLock({accountId,signal},fn) {
      const prev=tails.get(accountId)??Promise.resolve();let release;
      const gate=new Promise(r=>{release=r;}); const tail=prev.catch(()=>{}).then(()=>gate);tails.set(accountId,tail);
      await prev.catch(()=>{});
      try {check(signal);return await fn();} finally {release();if(tails.get(accountId)===tail)tails.delete(accountId);}
    },
    async loadConnection({accountId,signal}) {check(signal);return structuredClone(rows.get(accountId)??{epoch:0,connection:null});},
    async saveConnection({accountId,expectedEpoch,nextEpoch,connection,signal}) {
      check(signal);if((rows.get(accountId)?.epoch??0)!==expectedEpoch||nextEpoch!==expectedEpoch+1)return false;
      rows.set(accountId,structuredClone({epoch:nextEpoch,connection}));return true;
    },
  };
  const config={clientId:'synthetic-client',getClientSecret:async()=> 'synthetic-client-secret',redirectAllowlist:[URI],store,
    now:()=>clock,fetchImpl:async(url,init)=>{calls.push({url,init});const body=new URLSearchParams(init.body);return init.method==='DELETE'?new Response(null,{status:204}):json(payload(body.get('scope')==='offline'||options.offline,++count));},...options};
  const api=createWhoopOAuth(config);
  const begin=async(offline=false)=>{const r=await api.beginAuthorization({...A,offline});return new URL(r.authorizationUrl).searchParams.get('state');};
  const connect=async(offline=false)=>{const state=await begin(offline);return api.completeAuthorization({...A,state,code:'synthetic-code'});};
  return {api,config,store,states,rows,calls,begin,connect,tick:n=>{clock+=n;}};
}
async function code(promise,expected){await assert.rejects(promise,e=>e instanceof WhoopOAuthError&&e.code===expected&&!e.cause);}

test('authorization URL is exact; minimal scope; random hash-only stored state',async()=>{
  const f=fixture(); const r=await f.api.beginAuthorization(A);const u=new URL(r.authorizationUrl);
  assert.equal(u.origin+u.pathname,'https://api.prod.whoop.com/oauth/oauth2/auth');
  assert.equal(u.searchParams.get('scope'),'read:workout');assert.equal(u.searchParams.get('response_type'),'code');
  assert.equal(u.searchParams.get('redirect_uri'),URI);assert.equal(u.searchParams.get('client_id'),'synthetic-client');
  const state=u.searchParams.get('state');assert.match(state,/^[0-9a-f]{64}$/);assert.equal(r.expiresAt,1_800_000_300_000);
  assert.ok(!JSON.stringify([...f.states]).includes(state));assert.ok(!JSON.stringify([...f.states]).includes(A.sessionBinding));
  assert.notEqual(await f.begin(),state);assert.ok(!r.authorizationUrl.includes('secret'));
});
test('offline is explicit authorization scope',async()=>{const f=fixture();const r=await f.api.beginAuthorization({...A,offline:true});assert.equal(new URL(r.authorizationUrl).searchParams.get('scope'),'read:workout offline');});
test('exchange form contract; safe receipt and readonly DTO',async()=>{
  const f=fixture();const r=await f.connect();assert.deepEqual(Object.keys(r).sort(),['connected','expiresAt','offline','provider','scopes']);
  const {url,init}=f.calls[0];assert.equal(url,'https://api.prod.whoop.com/oauth/oauth2/token');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
  assert.equal(init.headers['Content-Type'],'application/x-www-form-urlencoded');
  const p=new URLSearchParams(init.body);assert.equal(p.get('grant_type'),'authorization_code');assert.equal(p.get('redirect_uri'),URI);assert.equal(p.get('code'),'synthetic-code');assert.equal(p.get('client_secret'),'synthetic-client-secret');
  assert.ok(!JSON.stringify(r).includes('synthetic-access'));assert.ok(!JSON.stringify(r).includes('synthetic-client-secret'));
  assert.deepEqual(await f.api.getReadonlyCredentials({accountId:A.accountId}),{accessToken:'synthetic-access-1',scopes:['read:workout']});
});
test('state replay rejected with no second exchange',async()=>{const f=fixture();const state=await f.begin();await f.api.completeAuthorization({...A,state,code:'one'});await code(f.api.completeAuthorization({...A,state,code:'two'}),'INVALID_STATE');assert.equal(f.calls.length,1);});
for(const [label,override] of [['account',{accountId:'account-b'}],['session',{sessionBinding:'wrong-session'}]])test(`state ${label} binding`,async()=>{const f=fixture();const state=await f.begin();await code(f.api.completeAuthorization({...A,...override,state,code:'code'}),'INVALID_STATE');assert.equal(f.calls.length,0);await f.api.completeAuthorization({...A,state,code:'code'});});
test('state expires at TTL exact boundary',async()=>{const f=fixture();const state=await f.begin();f.tick(300000);await code(f.api.completeAuthorization({...A,state,code:'code'}),'INVALID_STATE');assert.equal(f.calls.length,0);});
test('OAuth denial consumes state and never forwards provider error',async()=>{const f=fixture();const state=await f.begin();await code(f.api.completeAuthorization({...A,state,error:'synthetic-provider-error'}),'ACCESS_DENIED');await code(f.api.completeAuthorization({...A,state,code:'code'}),'INVALID_STATE');assert.equal(f.calls.length,0);});
test('failed exchange still consumes state',async()=>{const f=fixture({fetchImpl:async()=>new Response('secret detail',{status:400})});const state=await f.begin();await code(f.api.completeAuthorization({...A,state,code:'code'}),'UNAUTHORIZED');await code(f.api.completeAuthorization({...A,state,code:'code'}),'INVALID_STATE');});
test('revocation invalidates outstanding consent epoch',async()=>{const f=fixture();const state=await f.begin();assert.deepEqual(await f.api.revoke({accountId:A.accountId}),{provider:'whoop',connected:false,providerRevoked:false});await code(f.api.completeAuthorization({...A,state,code:'code'}),'INVALID_STATE');});
test('successful link invalidates other pending consent epoch',async()=>{const f=fixture();const old=await f.begin();await f.connect();await code(f.api.completeAuthorization({...A,state:old,code:'code'}),'INVALID_STATE');});
test('refresh requires offline consent',async()=>{const f=fixture();await f.connect();await code(f.api.refresh({accountId:A.accountId}),'OFFLINE_REQUIRED');assert.equal(f.calls.length,1);});
test('refresh form; replaces both tokens; readonly drops offline scope',async()=>{const f=fixture({offline:true});await f.connect(true);await f.api.refresh({accountId:A.accountId});const p=new URLSearchParams(f.calls[1].init.body);assert.equal(p.get('grant_type'),'refresh_token');assert.equal(p.get('scope'),'offline');assert.equal(p.get('refresh_token'),'synthetic-refresh-1');const c=f.rows.get(A.accountId).connection;assert.equal(c.refreshToken,'synthetic-refresh-2');assert.deepEqual(await f.api.getReadonlyCredentials({accountId:A.accountId}),{accessToken:'synthetic-access-2',scopes:['read:workout']});});
test('concurrent refresh serializes and uses latest rotated token',async()=>{const f=fixture({offline:true});await f.connect(true);await Promise.all([f.api.refresh({accountId:A.accountId}),f.api.refresh({accountId:A.accountId})]);assert.equal(new URLSearchParams(f.calls[2].init.body).get('refresh_token'),'synthetic-refresh-2');assert.equal(f.rows.get(A.accountId).epoch,3);});
test('revoke exact DELETE contract and clear only after 204',async()=>{const f=fixture();await f.connect();const r=await f.api.revoke({accountId:A.accountId});assert.equal(r.providerRevoked,true);const x=f.calls[1];assert.equal(x.url,'https://api.prod.whoop.com/developer/v2/user/access');assert.equal(x.init.method,'DELETE');assert.equal(x.init.headers.Authorization,'Bearer synthetic-access-1');assert.equal(x.init.body,undefined);assert.equal(f.rows.get(A.accountId).connection,null);});
test('revoke 401 is not falsely reported as success or erased',async()=>{const f=fixture();await f.connect();f.config.fetchImpl;const bad=createWhoopOAuth({...f.config,fetchImpl:async()=>new Response(null,{status:401})});await code(bad.revoke({accountId:A.accountId}),'UNAUTHORIZED');assert.ok(f.rows.get(A.accountId).connection);});
test('expiry refuses readonly credentials',async()=>{const f=fixture();await f.connect();f.tick(3600000);await code(f.api.getReadonlyCredentials({accountId:A.accountId}),'REAUTH_REQUIRED');});
test('disconnected credentials and refresh fail closed',async()=>{const f=fixture();await code(f.api.getReadonlyCredentials({accountId:A.accountId}),'NOT_CONNECTED');await code(f.api.refresh({accountId:A.accountId}),'NOT_CONNECTED');});
for(const uri of ['http://trainoracle.example/oauth/whoop','https://trainoracle.example/oauth/whoop#fragment','whoop://callback','https://user:password@trainoracle.example/cb','https://trainoracle.example/cb?next=x'])test(`invalid redirect config ${uri.split(':')[0]} ${uri.length}`,()=>{const f=fixture();assert.throws(()=>createWhoopOAuth({...f.config,redirectAllowlist:[uri]}),e=>e.code==='INVALID_CONFIG');});
test('exact redirect allowlist rejects prefix attacker',async()=>{const f=fixture();await code(f.api.beginAuthorization({...A,redirectUri:URI+'/evil'}),'INVALID_INPUT');});
test('callback redirect bound even when both URLs allowlisted',async()=>{const f=fixture({redirectAllowlist:[URI,URI+'2']});const state=await f.begin();await code(f.api.completeAuthorization({...A,redirectUri:URI+'2',state,code:'code'}),'INVALID_STATE');assert.equal(f.calls.length,0);});
for(const [name,patch] of [
 ['missing access',{access_token:undefined}],['header injection',{access_token:'bad\r\nheader'}],['wrong token type',{token_type:'Basic'}],
 ['zero expiry',{expires_in:0}],['string expiry',{expires_in:'3600'}],['huge expiry',{expires_in:1e100}],
 ['scope escalation',{scope:'read:workout read:profile'}],['missing scope',{scope:undefined}],['duplicate scope',{scope:'read:workout read:workout'}],
 ['unasked refresh',{refresh_token:'synthetic-unasked'}],
])test(`token validation: ${name}`,async()=>{const f=fixture({fetchImpl:async()=>json({...payload(),...patch})});await code(f.connect(),'INVALID_RESPONSE');assert.equal(f.rows.size,0);});
test('offline missing rotated refresh token fails closed',async()=>{const f=fixture({offline:true});await f.connect(true);const bad=createWhoopOAuth({...f.config,fetchImpl:async()=>json({...payload(true,2),refresh_token:undefined})});await code(bad.refresh({accountId:A.accountId}),'INVALID_RESPONSE');assert.equal(f.rows.get(A.accountId).connection.refreshToken,'synthetic-refresh-1');});
test('refresh reused tokens rejected',async()=>{const f=fixture({offline:true});await f.connect(true);const bad=createWhoopOAuth({...f.config,fetchImpl:async()=>json(payload(true))});await code(bad.refresh({accountId:A.accountId}),'INVALID_RESPONSE');});
for(const [status,expected] of [[302,'REDIRECT_REJECTED'],[401,'UNAUTHORIZED'],[429,'RATE_LIMITED'],[500,'UPSTREAM_FAILURE']])test(`HTTP ${status} errors redacted`,async()=>{const f=fixture({fetchImpl:async()=>new Response('synthetic secret provider detail',{status})});await code(f.connect(),expected);});
test('transport exception content never exposed',async()=>{const f=fixture({fetchImpl:async()=>{throw Error('synthetic-secret-url');}});await assert.rejects(f.connect(),e=>e.code==='TRANSPORT_FAILURE'&&!String(e).includes('secret')&&!e.cause);});
test('credentials provider exception redacted',async()=>{const f=fixture({getClientSecret:async()=>{throw Error('synthetic secret');}});await code(f.connect(),'CREDENTIALS_UNAVAILABLE');});
test('response URL mismatch rejected even injected fetch ignores redirect:error',async()=>{const f=fixture({fetchImpl:async()=>({status:200,url:'https://attacker.example',headers:new Headers(),body:null})});await code(f.connect(),'REDIRECT_REJECTED');});
test('content-length bound',async()=>{const f=fixture({fetchImpl:async()=>json(payload(),{headers:{'content-type':'application/json','content-length':'9999999'}})});await code(f.connect(),'BODY_LIMIT');});
test('stream bound without content-length',async()=>{const f=fixture({maxBodyBytes:10});await code(f.connect(),'BODY_LIMIT');});
test('wrong response content type',async()=>{const f=fixture({fetchImpl:async()=>new Response('not json')});await code(f.connect(),'INVALID_RESPONSE');});
test('invalid JSON',async()=>{const f=fixture({fetchImpl:async()=>new Response('{',{headers:{'content-type':'application/json'}})});await code(f.connect(),'INVALID_RESPONSE');});
test('invalid UTF8',async()=>{const f=fixture({fetchImpl:async()=>new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/json'}})});await code(f.connect(),'INVALID_RESPONSE');});
test('timeout covers secret lookup',async()=>{const f=fixture({timeoutMs:20,getClientSecret:()=>new Promise(()=>{})});await code(f.connect(),'TIMEOUT');assert.equal(f.rows.size,0);});
test('timeout covers store lookup',async()=>{const f=fixture({timeoutMs:20});f.store.loadConnection=()=>new Promise(()=>{});await code(f.begin(),'TIMEOUT');});
test('timeout covers fetch ignoring abort; late body canceled, no late save',async()=>{
  let release,canceled=false;const late=new Promise(r=>{release=r;});const f=fixture({timeoutMs:20,fetchImpl:()=>late});
  await code(f.connect(),'TIMEOUT');
  release(new Response(new ReadableStream({cancel(){canceled=true;}}),{headers:{'content-type':'application/json'}}));
  await new Promise(r=>setTimeout(r,10));assert.equal(canceled,true);assert.equal(f.rows.size,0);
});
test('timeout covers stalled stream; cancel ignoring completion cannot hang',async()=>{let canceled=false;const f=fixture({timeoutMs:20,fetchImpl:async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){canceled=true;return new Promise(()=>{});}}),{headers:{'content-type':'application/json'}})});await code(f.connect(),'TIMEOUT');assert.equal(canceled,true);assert.equal(f.rows.size,0);});
test('CAS failure never reports connected',async()=>{const f=fixture();f.store.saveConnection=async()=>false;await code(f.connect(),'STALE_CONNECTION');});
test('store exception detail redacted',async()=>{const f=fixture();f.store.putState=async()=>{throw Error('synthetic sensitive db data');};await code(f.begin(),'STORE_FAILURE');});
test('forged store state metadata rechecked',async()=>{const f=fixture();const state=await f.begin();for(const r of f.states.values())r.issuedAt+=1;await code(f.api.completeAuthorization({...A,state,code:'code'}),'INVALID_STATE');});
test('browser runtime rejected',()=>{const f=fixture();globalThis.window={};try{assert.throws(()=>createWhoopOAuth(f.config),e=>e.code==='SERVER_ONLY');}finally{delete globalThis.window;}});

// Independent-review regressions: lock release and conservative token expiry.
for (const dependency of ['secret','fetch']) test(`regression: abort-ignoring pending ${dependency} releases account lock for disconnect and reauth`,async()=>{
  let entered=false;
  const pending=()=>{entered=true;return new Promise(()=>{});};
  const f=fixture({timeoutMs:100,...(dependency==='secret'?{getClientSecret:pending}:{fetchImpl:pending})});
  await code(f.connect(),'TIMEOUT');assert.equal(entered,true);
  // Uses the exact same store/account/lock while the original dependency stays pending.
  assert.equal((await f.api.revoke({accountId:A.accountId})).connected,false);
  const state=await f.begin();
  const healthy=fixture();
  const reauth=createWhoopOAuth({...f.config,getClientSecret:healthy.config.getClientSecret,fetchImpl:healthy.config.fetchImpl});
  assert.equal((await reauth.completeAuthorization({...A,state,code:'synthetic-new-code'})).connected,true);
  assert.equal(f.rows.get(A.accountId).epoch,2);
});
test('regression: timeout releases lock; late fetch cannot overwrite newer reauth',async()=>{
  let release,canceled=false;
  const late=new Promise(r=>{release=r;});
  const f=fixture({timeoutMs:100,fetchImpl:()=>late});
  await code(f.connect(),'TIMEOUT');
  await f.api.revoke({accountId:A.accountId});
  const healthy=fixture();
  const reauth=createWhoopOAuth({...f.config,fetchImpl:healthy.config.fetchImpl});
  const state=await f.begin();await reauth.completeAuthorization({...A,state,code:'new-code'});
  const before=structuredClone(f.rows.get(A.accountId));
  release(new Response(new ReadableStream({cancel(){canceled=true;}}),{headers:{'content-type':'application/json'}}));
  await new Promise(r=>setTimeout(r,10));
  assert.equal(canceled,true);assert.deepEqual(f.rows.get(A.accountId),before);
});
for (const mode of ['authorization','refresh']) test(`regression: ${mode} rejects expires_in=1 after body advances fake clock 2 seconds`,async()=>{
  const f=fixture({offline:mode==='refresh'});
  if(mode==='refresh')await f.connect(true);
  const before=structuredClone(f.rows.get(A.accountId));
  const delayed=createWhoopOAuth({...f.config,fetchImpl:async()=>new Response(new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify({...payload(mode==='refresh',2),expires_in:1})));},
    pull(controller){f.tick(2000);controller.close();},
  }),{headers:{'content-type':'application/json'}})});
  if(mode==='refresh')await code(delayed.refresh({accountId:A.accountId}),'REAUTH_REQUIRED');
  else {const state=await f.begin();await code(delayed.completeAuthorization({...A,state,code:'synthetic-code'}),'REAUTH_REQUIRED');}
  assert.deepEqual(f.rows.get(A.accountId),before);
});
test('regression: expiresAt uses request start, not response completion or secret lookup start',async()=>{
  const f=fixture();const start=1_800_000_000_000;
  const delayed=createWhoopOAuth({...f.config,
    getClientSecret:async()=>{f.tick(3000);return 'synthetic-client-secret';},
    fetchImpl:async()=>{f.tick(2000);return json(payload());},
  });
  const state=await f.begin();const r=await delayed.completeAuthorization({...A,state,code:'synthetic-code'});
  assert.equal(r.expiresAt,start+3000+3600000);
  assert.equal(f.rows.get(A.accountId).connection.expiresAt,r.expiresAt);
});

for (const delimiter of ['#','?']) test(`redirect delimiter regression: rejects empty ${delimiter} in raw callback URI`,()=>{
  const f=fixture();const uri=URI+delimiter;
  // URL getters normalize empty fragment/search to '', but raw delimiters
  // must still be rejected under the no-fragment/no-query redirect policy.
  const parsed=new URL(uri);
  assert.equal(delimiter==='#'?parsed.hash:parsed.search,'');
  assert.throws(()=>createWhoopOAuth({...f.config,redirectAllowlist:[uri]}),e=>e instanceof WhoopOAuthError&&e.code==='INVALID_CONFIG');
});
