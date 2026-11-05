import {randomUUID} from 'node:crypto';
import {fail} from './primitives.mjs';

const credentialContext=row=>({ownerId:row.user_id,connectionId:row.connection_id,epoch:row.epoch,purpose:'credentials',record:''});
// Garmin OAuth2 PKCE recommends at least 600 seconds of headroom. Use the
// provider's returned expirations, including refresh expiry during inactivity.
const REFRESH_HEADROOM_MS=600_000;
const due=credentials=>Math.min(Date.parse(credentials.expiresAt),Date.parse(credentials.refreshExpiresAt??credentials.expiresAt));
const nextDue=(credentials,now)=>new Date(Math.min(now+6*3600_000,Math.max(now+60_000,due(credentials)-REFRESH_HEADROOM_MS))).toISOString();

/** No token is returned or logged. The database lease and purpose/epoch checks
 * remain authoritative across network calls, disconnect, withdrawal and restart. */
export function createGarminMaintenance({repository,provider,vault,now=()=>Date.now()}) {
  const call=input=>repository.maintenance({configHash:provider.configHash,...input});
  const identity=row=>({ownerId:row.user_id,connectionId:row.connection_id,epoch:row.epoch,
    credentialRevision:row.credential_revision,lease:row.refresh_nonce});

  async function finish(row,credentials) {
    const permissions=await provider.permissions(credentials);
    const finished=await call({action:'finish',...identity(row),permissions,nextDueAt:nextDue(credentials,now())});
    return {refreshed:finished.kind==='completed'?1:0,reconnectRequired:finished.kind==='reconnect_required'?1:0};
  }

  async function rotate(row,{sessionId}={}) {
    const expected=identity(row);let revision=row.credential_revision,started=false;
    try {
      const credentials=await vault.open(row.credential,credentialContext(row));
      if((await call({action:'start',...expected,...(sessionId?{sessionId}:{})})).kind!=='started')fail(409,'CONNECTION_CHANGED');
      started=true;
      const next=await provider.refresh(credentials);
      // Persist the rotating successor BEFORE another remote operation. Permission
      // failure cannot leave the database holding the now-obsolete refresh token.
      const saved=await call({action:'save',...expected,credential:await vault.seal(next,credentialContext(row))});
      if(saved.kind!=='saved')return {refreshed:0,reconnectRequired:saved.kind==='retained'?1:0};
      revision=saved.credentialRevision;
      return await finish({...row,credential_revision:revision},next);
    } catch(error) {
      if(started){try{await call({action:'fail',...expected,credentialRevision:revision});}catch{/* A lost/ambiguous rotation remains leased and cannot be retried with the old token. */}}
      else {try{await call({action:'abortBeforeExchange',...expected});}catch{/* A lost cleanup reply remains conservative; no token endpoint has been invoked. */}}
      throw error;
    }
  }

  async function processOne() {
    const result=await call({action:'claim',lease:randomUUID()}),row=result.row;
    if(!row)return {checked:0,refreshed:0,reconnectRequired:result.reconnectRequired?1:0};
    const credentials=await vault.open(row.credential,credentialContext(row));
    // A failed permission read after save is resumable. The database already owns
    // the successor, so retry that read without exchanging its refresh token.
    if(row.rotation_phase==='ROTATED'&&due(credentials)>now()+REFRESH_HEADROOM_MS){
      try{return {checked:1,...await finish(row,credentials)};}
      catch(error){try{await call({action:'fail',...identity(row)});}catch{/* Lease expiry resumes the persisted successor. */}throw error;}
    }
    if(row.rotation_phase!=='ROTATED'&&due(credentials)>now()+REFRESH_HEADROOM_MS){
      const result=await call({action:'defer',...identity(row),nextDueAt:nextDue(credentials,now())});
      return {checked:result.kind==='completed'?1:0,refreshed:0,reconnectRequired:0};
    }
    const resultAfter=await rotate(row);return {checked:1,...resultAfter};
  }

  async function revoke(row) {
    const expected={ownerId:row.user_id,id:row.id,lease:row.lease_id};
    let checked=(await call({action:'checkRevocation',...expected})).row;
    if(!checked||Date.parse(checked.lease_until)-now()<20000)return false;
    let credentials=await vault.open(checked.credential,credentialContext(checked));
    if(Date.parse(credentials.expiresAt)<=now()+30000){
      if((await call({action:'startRevocationRotation',...expected})).kind!=='started')return false;
      // A failed/unknown exchange deliberately leaves STARTED persisted. Reusing
      // that refresh token could corrupt its successor; user revocation stays pending.
      credentials=await provider.refresh(credentials);
      const saved=await call({action:'saveRevocationRotation',...expected,credential:await vault.seal(credentials,credentialContext(checked))});
      if(saved.kind!=='saved')return false;
    }
    checked=(await call({action:'checkRevocation',...expected})).row;
    if(!checked||Date.parse(checked.lease_until)-now()<10000)return false;
    if(!await provider.revoke(credentials))return false;
    return (await call({action:'finishRevocation',...expected})).kind==='revoked';
  }
  async function revocations() {
    const row=(await call({action:'claimRevocation',lease:randomUUID()})).row;
    if(!row)return {completed:0,pending:0};
    try{const completed=await revoke(row);return {completed:completed?1:0,pending:completed?0:1};}
    catch{return {completed:0,pending:1};}
  }
  return {processOne,rotate,revoke,revocations};
}
