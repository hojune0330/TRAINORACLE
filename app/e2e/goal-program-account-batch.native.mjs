import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Reads the parent's local Vite server only. An isolated, unauthenticated context
// blocks every other origin; no account token, production API or UI profile.
const origin=process.env.GOAL_PROGRAM_LOCAL_ORIGIN ?? 'http://127.0.0.1:4176';
if(!/^http:\/\/127\.0\.0\.1:\d+$/u.test(origin)) throw Error('Local origin required');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin) return route.abort();
  if(url.pathname==='/__goal_batch_test__') return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic account batch</title>'});
  return route.continue();
});
try {
  const page=await context.newPage();
  await page.goto(origin+'/__goal_batch_test__');
  const result=await page.evaluate(async()=>{
    const {createAccountDocumentBuffer,accountJournalDraftSchema}=await import('/src/domain/account/account-journal-draft-buffer.ts');
    const revisions=await import('/src/domain/account/storage-consent-revision.ts');
    const dbName='trainoracle-goal-program-synthetic-atomic-batch';
    const owner='a1111111-1111-4111-8111-111111111111';
    const doc=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
    const payload=n=>({version:1,state:'DRAFT',visibility:'PRIVATE',date:'2026-10-10',title:'',body:`SYNTHETIC_BATCH_PRIVATE_${n}`});
    let buffer=createAccountDocumentBuffer(accountJournalDraftSchema,dbName);
    async function raw() {
      return new Promise((resolve,reject)=>{
        const request=indexedDB.open(dbName);
        request.onerror=()=>reject(Error('Synthetic raw read unavailable'));
        request.onsuccess=()=>{
          const db=request.result,tx=db.transaction(['drafts','ownerKeys'],'readonly');
          const rows=tx.objectStore('drafts').getAll(),keys=tx.objectStore('ownerKeys').getAll();
          tx.onerror=()=>reject(Error('Synthetic raw transaction unavailable'));
          tx.oncomplete=()=>{db.close();resolve({rows:rows.result,keys:keys.result})};
        };
      });
    }
    revisions.rememberStorageConsentRevision(owner,1);
    await buffer.saveDraftBatch(owner,[{documentId:doc(1),draft:payload(1),expectedLocalSequence:0},{documentId:doc(2),draft:payload(2),expectedLocalSequence:0}]);
    const before=JSON.stringify((await raw()).rows);
    let conflict=false;
    try { await buffer.saveDraftBatch(owner,[{documentId:doc(1),draft:payload(101),expectedLocalSequence:1},{documentId:doc(2),draft:payload(102),expectedLocalSequence:0}]); }
    catch { conflict=true }
    const rolledBack=conflict && before===JSON.stringify((await raw()).rows);
    let active=true,late=false;
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args) {
      const request=Reflect.apply(put,this,args);
      if(this.name==='drafts') active=false;
      return request;
    };
    try { await buffer.saveDraftBatch(owner,[{documentId:doc(1),draft:payload(201),expectedLocalSequence:1},{documentId:doc(2),draft:payload(202),expectedLocalSequence:1}],()=>active); }
    catch { late=true }
    finally { IDBObjectStore.prototype.put=put }
    const lateTransactionRollback=late && before===JSON.stringify((await raw()).rows);

    async function duringEncryption(change) {
      const encrypt=crypto.subtle.encrypt.bind(crypto.subtle);
      let release,reached;
      const hold=new Promise(resolve=>{release=resolve}),started=new Promise(resolve=>{reached=resolve});
      crypto.subtle.encrypt=async(...args)=>{reached();await hold;return encrypt(...args)};
      let current=true,failed=false;
      const saving=buffer.saveDraftBatch(owner,[{documentId:doc(3),draft:payload(3),expectedLocalSequence:0},{documentId:doc(4),draft:payload(4),expectedLocalSequence:0}],()=>current);
      try {
        await started;
        if(change==='OWNER') current=false;
        else revisions.rememberStorageConsentRevision(owner,3);
        release();await saving;
      } catch { failed=true }
      finally { crypto.subtle.encrypt=encrypt }
      return failed && before===JSON.stringify((await raw()).rows);
    }
    const lateOwnerRollback=await duringEncryption('OWNER');
    const lateConsentRollback=await duringEncryption('CONSENT');
    const atRest=await raw();
    const encryptedOnly=!JSON.stringify(atRest.rows).includes('SYNTHETIC_BATCH_PRIVATE')
      && atRest.rows.every(row=>row.encryptedCurrent && !('draft' in row) && !('body' in row))
      && atRest.keys.length===1 && atRest.keys.every(key=>key instanceof CryptoKey && key.extractable===false);
    const operation='33333333-3333-4333-8333-333333333333';
    await buffer.queue(owner,doc(1),operation);
    buffer.close();buffer=createAccountDocumentBuffer(accountJournalDraftSchema,dbName);
    const reopened=await buffer.read(owner,doc(1));
    const fixedReplay=reopened?.pending?.operationId===operation && reopened.pending.expectedRevision===0
      && reopened.pending.draft.body==='SYNTHETIC_BATCH_PRIVATE_1'
      && revisions.pinStorageOperationRevision(owner,operation)===1;
    buffer.close();
    const monthly=await import('/src/domain/account/account-goal-program-schema.ts');
    const {disposeGoalProgramDatabase}=await import('/src/domain/account/goal-program-database-disposal.ts');
    const monthlyBuffer=createAccountDocumentBuffer(monthly.accountGoalProgramDocumentSchema,monthly.ACCOUNT_GOAL_PROGRAM_BUFFER);
    const indexId=await monthly.accountGoalProgramDocumentId(owner);
    await monthlyBuffer.saveDraft(owner,indexId,monthly.emptyAccountGoalProgramIndex(),0);
    const seeded=(await monthlyBuffer.read(owner,indexId))?.draft.kind==='GOAL_PROGRAM_INDEX';
    // Deliberately keep its connection open: success requires versionchange close.
    const disposal=await disposeGoalProgramDatabase();
    const monthlyDisposalConfirmed=seeded && disposal.ok && disposal.failed.length===0
      && !(await indexedDB.databases()).some(db=>db.name===monthly.ACCOUNT_GOAL_PROGRAM_BUFFER);
    const monthlyRecordAbsentAfterReopen=(await monthlyBuffer.read(owner,indexId))===null;
    monthlyBuffer.close();
    return {rolledBack,lateTransactionRollback,lateOwnerRollback,lateConsentRollback,encryptedOnly,fixedReplay,
      monthlyDisposalConfirmed,monthlyRecordAbsentAfterReopen,records:atRest.rows.length};
  });
  for(const [key,value] of Object.entries(result)) if(key!=='records') assert.equal(value,true,key);
  assert.equal(result.records,2);
  console.log(JSON.stringify({nativeAtomicBatch:'PASS',...result}));
} finally { await context.close();await browser.close() }
