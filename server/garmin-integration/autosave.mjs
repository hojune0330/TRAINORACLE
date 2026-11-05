import {stableUuid, IntegrationError} from './primitives.mjs';

export const SAVE_CONSENT_VERSION='GARMIN_AUTO_SAVE_2026_11_05';
/** No browser session, token or foreground tab is needed. The database rechecks
 * consent, epoch, revision and operational gates at the atomic commit. */
export function createGarminAutosave({repository,configHash,decode,sourceContext,prepare}) {
  return async function processOne() {
    const {row}=await repository.autosave(null,{action:'next',configHash});
    if(!row)return {saved:0,reviewRequired:0};
    const target={configHash,ownerId:row.user_id,consentRevision:row.storage_consent_revision,epoch:row.epoch,inboxId:row.inbox_id,expectedRevision:row.source_revision,preferenceRevision:row.save_preference_revision};
    const review=async()=>{await repository.autosave(null,{...target,action:'review'});return {saved:0,reviewRequired:1};};
    try {
      const observation=await decode(row),source=await sourceContext(row);
      if(!observation||observation.distanceMeters===null||observation.durationSeconds===null
        ||observation.durationMeaning==='UNKNOWN'||source?.manual||source?.parent?.isParent||source?.parent?.parentSummaryId)return await review();
      const operationId=stableUuid(['trainoracle.garmin.autosave.v1',row.user_id,row.activity_hash]);
      const proposal=await prepare({ownerId:row.user_id},row,observation,source?.clock,operationId);
      const result=await repository.autosave(null,{...target,action:'commit',operationId,...proposal});
      return {saved:result.kind==='saved'?1:0,reviewRequired:result.kind==='review_required'?1:0};
    } catch(error) {
      if(error instanceof IntegrationError&&['CONNECTION_CHANGED','CONSENT_CHANGED','SOURCE_CHANGED'].includes(error.code))return {saved:0,reviewRequired:0};
      try { await repository.autosave(null,{...target,action:'defer'}); } catch { /* Original failure is retried without exposing payloads. */ }
      throw error;
    }
  };
}
