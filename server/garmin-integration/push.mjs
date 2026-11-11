import {randomUUID} from 'node:crypto';
import {authenticateGarminPush,parseGarminPush,normalizeGarminActivity} from './garmin-starter.mjs';
import {canonical,sha,sign,stableUuid,boundedJson,fail,prepareObservation,prepareDetail,IntegrationError} from './primitives.mjs';

const ctx=(ownerId,connectionId,epoch,purpose,record)=>({ownerId,connectionId,epoch,purpose,record});
/** Actual Starter PUSH ingest. The provider source is checked at the TCP/proxy
 * boundary. A minimal encrypted durable job is acknowledged before normalization,
 * journal mutation or outbound provider HTTP. No PING/PULL/history route exists. */
export function createGarminPushRuntime({repository,vault,provider,identityKey,enabled=false,trustedProxyAddresses=[],testDeliveryCidrs,allowLocalHttp=false}) {
  if(testDeliveryCidrs&&!allowLocalHttp)fail(503,'CONFIGURATION_INVALID');
  const configHash=provider?.configHash;
  const relay=input=>repository.relay({configHash,...input});
  const subjectHash=subject=>sign(identityKey,`garmin-subject-v1:${subject}`);
  return {
    async ingress(request,peerAddress){
      if(!enabled||provider?.kind!=='GARMIN_STARTER'||!provider.isCurrent())fail(503,'PROVIDER_CONFIGURATION_PENDING');
      if(request.headers.get('origin'))fail(403,'ACCESS_DENIED');
      authenticateGarminPush(request,peerAddress,{clientId:provider.clientId,trustedProxyAddresses,...(testDeliveryCidrs?{deliveryCidrs:testDeliveryCidrs}:{})});
      const rows=parseGarminPush(await boundedJson(request,6_500_000),{allowedSummaryFields:provider.allowedSummaryFields});let queued=0,ignored=0;
      for(const row of rows){
        const hashed=subjectHash(row.userId);let connection;
        try{connection=await relay({action:'resolveSubject',subjectHash:hashed});}
        catch(error){if(error instanceof IntegrationError&&error.code==='CONNECTION_CHANGED'){ignored++;continue;}throw error;}
        if(['userPermissionsChange','deregistrations'].includes(row.feed)){
          await relay({action:'enqueue',connectionId:connection.connectionId,epoch:connection.epoch,subjectHash:hashed,feed:row.feed,
            ...(row.feed==='userPermissionsChange'?{permissions:row.permissions,changeTime:row.changeTimeInSeconds}:{})});queued++;continue;
        }
        if(connection.state!=='ACTIVE'){ignored++;continue;}
        const text=canonical(row),id=stableUuid(['trainoracle.garmin.push.v1',connection.connectionId,connection.epoch,sha(text)]),bytes=Buffer.from(text);
        const parts=[];for(let start=0;start<bytes.length;start+=128000){parts.push(await vault.seal(bytes.subarray(start,start+128000).toString('base64'),ctx(connection.ownerId,connection.connectionId,connection.epoch,'push',`${id}:${parts.length}`)));}
        await relay({action:'enqueue',id,connectionId:connection.connectionId,epoch:connection.epoch,subjectHash:hashed,feed:row.feed,encryptedParts:parts});queued++;
      }
      return {kind:'queued',queued,ignored};
    },
    async processOne(){
      if(!enabled||provider?.kind!=='GARMIN_STARTER'||!provider.isCurrent())fail(503,'PROVIDER_CONFIGURATION_PENDING');
      const lease=randomUUID(),job=(await relay({action:'jobs',lease})).job;if(!job)return {processed:0,reviewRequired:0};
      let outcome='PROCESSED';
      try{
        const chunks=[];for(let i=0;i<job.encrypted_parts.length;i++)chunks.push(Buffer.from(await vault.open(job.encrypted_parts[i],ctx(job.user_id,job.connection_id,job.epoch,'push',`${job.id}:${i}`)),'base64'));
        const row=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
        const mapped=normalizeGarminActivity(row,provider.allowedDetailFields,provider.allowedSummaryFields),observation=prepareObservation(mapped.observation),parts=prepareDetail(mapped.detail,provider.allowedDetailFields);
        const activityHash=sign(identityKey,`garmin-activity-v1:${row.userId}:${observation.sourceId}`);
        const base=await relay({action:'resolve',connectionId:job.connection_id,epoch:job.epoch,subjectHash:subjectHash(row.userId),activityHash});
        const revision=base.nextRevision,inboxId=stableUuid(['trainoracle.garmin.inbox.v1',job.connection_id,job.epoch,activityHash]);
        const detailManifest=parts.map((p,partIndex)=>({partIndex,sha256:sha(canonical(p)),sampleCount:p.length}));
        // clock/manual/parent are factual source metadata; no activity title/note
        // enters this store or any AI source registry. Exact timing remains in the
        // durable job for conflicts; normalized sensor detail remains independently encrypted.
        const sourceContext={clock:mapped.clock,manual:mapped.manual,parent:mapped.parent,summaryId:mapped.summaryId,lapStartOffsetsSeconds:mapped.lapStartOffsetsSeconds,summary:mapped.summary,
          monitoringPeriod:{basis:'GARMIN_MONITORING_PERIOD',seconds:mapped.observation.durationSeconds}};
        const coreDigest=sha(canonical({observation,clock:mapped.clock,manual:mapped.manual,parent:mapped.parent,summary:mapped.summary}));
        const result=await relay({action:'ingestWire',connectionId:job.connection_id,epoch:job.epoch,ownerId:job.user_id,subjectHash:subjectHash(row.userId),activityHash,inboxId,
          sourceRevision:revision,kind:'UPSERT',eventHash:sha(job.id),payloadDigest:sha(canonical(row)),coreDigest,
          contentDigest:sha(canonical({coreDigest,detailManifest,lapStartOffsetsSeconds:mapped.lapStartOffsetsSeconds})),detailManifest,
          encryptedContext:await vault.seal(sourceContext,ctx(job.user_id,job.connection_id,job.epoch,'source-context',`${inboxId}:${revision}`)),
          encryptedObservation:await vault.seal(observation,ctx(job.user_id,job.connection_id,job.epoch,'observation',`${inboxId}:${revision}`)),
          encryptedParts:await Promise.all(parts.map((part,index)=>vault.seal(part,ctx(job.user_id,job.connection_id,job.epoch,'detail',`${inboxId}:${revision}:${index}`))))});
        if(['conflict','review_required'].includes(result.kind))outcome='REVIEW_REQUIRED';
      }catch(error){
        if(error instanceof IntegrationError&&['CONNECTION_CHANGED','CONSENT_CHANGED'].includes(error.code))outcome='STALE';
        else if(error instanceof IntegrationError&&error.status===422)outcome='REVIEW_REQUIRED';
        else throw error; // lease expires; exact same durable job can retry safely
      }
      await relay({action:'completeJob',id:job.id,lease,outcome});return {processed:outcome==='PROCESSED'?1:0,reviewRequired:outcome==='REVIEW_REQUIRED'?1:0,stale:outcome==='STALE'?1:0};
    },
  };
}
