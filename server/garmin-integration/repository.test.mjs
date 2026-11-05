import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSupabaseRepository} from './repository.mjs';

test('public user calls and service background RPCs keep distinct gateway credentials',async()=>{
  const ownerId=randomUUID(),sessionId=randomUUID();
  const token=`synthetic.${Buffer.from(JSON.stringify({sub:ownerId,session_id:sessionId,exp:Math.floor(Date.now()/1000)+600})).toString('base64url')}.signature`;
  const publishableKey='sb_publishable_synthetic';
  for(const serviceRoleKey of ['synthetic-legacy-service-jwt','sb_secret_synthetic']){
    const seen=[];let serverExpected=false;
    const repo=createSupabaseRepository({url:'https://synthetic.supabase.co',publishableKey,serviceRoleKey,
      attestation:{keyId:'runtime',key:Buffer.alloc(32,1).toString('base64')},relayAttestation:{keyId:'relay',key:Buffer.alloc(32,2).toString('base64')},
      fetchImpl:async(url,init)=>{
        seen.push({path:new URL(url).pathname,...init});
        const valid=init.headers.apikey===(serverExpected?serviceRoleKey:publishableKey)&&init.headers.authorization===`Bearer ${serverExpected?serviceRoleKey:token}`;
        if(!valid)return Response.json({error:'synthetic_gateway_denied'},{status:401});
        return Response.json(new URL(url).pathname==='/auth/v1/user'?{id:ownerId}:{});
      }});
    const auth=await repo.authenticate(token,3);
    await repo.call(auth,{action:'status'});
    await repo.autosave(auth,{action:'preferences'});
    for(const item of seen){assert.equal(item.headers.apikey,publishableKey);assert.equal(item.headers.authorization,`Bearer ${token}`);}
    serverExpected=true;
    await repo.relay({action:'jobs'});
    await repo.maintenance({action:'claim'});
    await repo.autosave(null,{action:'claim',consentRevision:3});
    for(const item of seen.slice(3)){
      assert.equal(item.headers.apikey,serviceRoleKey);assert.equal(item.headers.authorization,`Bearer ${serviceRoleKey}`);
      assert.equal(JSON.parse(item.body).key_id,'relay');
      assert.equal(Object.hasOwn(JSON.parse(JSON.parse(item.body).request_text),'sessionId'),false);
    }
    assert.equal(seen[1].headers['x-trainoracle-storage-revision'],'3');
    assert.equal(seen[5].headers['x-trainoracle-storage-revision'],'3');
    assert.equal(seen.length,6);
  }
});
