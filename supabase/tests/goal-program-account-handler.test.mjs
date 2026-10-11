import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createAccountJournalHandler, importJournalKeyring, validateAccountJournalDocument } from '../functions/_shared/account-journal-handler.mjs';
import * as state from '../functions/_shared/account-state-validator.mjs';

const app=new URL('../../app/',import.meta.url),require=createRequire(new URL('package.json',app));
const {build}=require('esbuild');
const bundled=await build({absWorkingDir:fileURLToPath(app),entryPoints:['src/domain/account/account-goal-program.test-fixtures.ts'],
  bundle:true,write:false,format:'esm',platform:'node',target:'es2022',tsconfig:'tsconfig.json'});
const {syntheticGoalProgram}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const owner='a1111111-1111-4111-8111-111111111111',other='b2222222-2222-4222-8222-222222222222';
const origin='https://synthetic-goal-program.example.test';
const material=await importJournalKeyring(JSON.stringify({activeKeyId:'synthetic',keys:{synthetic:Buffer.alloc(32,61).toString('base64')}}));

// Import the pure client packing code in memory too, with no storage/auth bundle.
const packing=await build({absWorkingDir:fileURLToPath(app),entryPoints:['src/domain/account/account-goal-program-schema.ts'],bundle:true,write:false,
  format:'esm',platform:'node',target:'es2022',tsconfig:'tsconfig.json'});
const {splitAccountGoalProgramCollection}=await import(`data:text/javascript;base64,${Buffer.from(packing.outputFiles[0].text).toString('base64')}`);
const retained={version:1,entries:[]};

async function fixture() {
  const rows=new Map(),operations=new Map(),commits=[];
  const key=(user,id)=>`${user}:${id}`;
  const repo={
    enabled:async()=>true,
    goalProgramSupport:async()=>({kind:'goal-program-support',version:1}),
    operation:async(user,id)=>operations.get(key(user,id))??null,
    read:async(user,id)=>rows.get(key(user,id))??null,
    list:async(user,limit,cursor='')=>[...rows.values()].filter(row=>row.user_id===user&&row.document_id>cursor)
      .sort((a,b)=>a.document_id.localeCompare(b.document_id)).slice(0,limit),
    async commit(input) {
      assert.equal('document' in input,false,'plain program must not reach encrypted repository');
      commits.push(input);
      const currentRevision=rows.get(key(owner,input.documentId))?.revision??0;
      const result=currentRevision===input.expectedRevision
        ? {kind:'saved',documentId:input.documentId,operationId:input.operationId,revision:currentRevision+1}
        : {kind:'conflict',documentId:input.documentId,operationId:input.operationId,currentRevision};
      operations.set(key(owner,input.operationId),{user_id:owner,operation_id:input.operationId,document_id:input.documentId,
        expected_revision:input.expectedRevision,operation_kind:'commit',source_revision:null,proposed_encrypted_payload:input.encryptedPayload,
        result,trusted_metadata:input.metadata});
      if(result.kind==='saved') rows.set(key(owner,input.documentId),{user_id:owner,document_id:input.documentId,revision:result.revision,encrypted_payload:input.encryptedPayload});
      return result;
    },
  };
  const handler=createAccountJournalHandler({allowedOrigins:[origin],validateDocument:validateAccountJournalDocument,authenticate:async token=>token==='synthetic'
    ? {ownerId:owner,repo}:token==='other'?{ownerId:other,repo}:null,getMaterial:async()=>material});
  const request=async(body,token='synthetic')=>{
    const response=await handler(new Request('https://synthetic-gateway.example.test/account-journal',{method:'POST',body:JSON.stringify(body),
      headers:{Origin:origin,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}}));
    assert.equal(response.headers.get('cache-control'),'no-store');
    return {status:response.status,data:await response.json()};
  };
  const save=async(document,expectedRevision=0,operationId=randomUUID(),documentId)=>request({action:'save',document,
    documentId:documentId??await state.accountGoalProgramDocumentId(owner,document.kind,document.kind==='GOAL_PROGRAM_INDEX'?undefined:document.data.id),operationId,expectedRevision});
  const stage=async(value)=>{for(const part of value.parts) assert.equal((await save(part)).status,200)};
  return {request,save,stage,repo,rows,commits,operations,key};
}

test('capability is additive, authenticated, exact-version and required before monthly writes',async()=>{
  const f=await fixture(),value=splitAccountGoalProgramCollection(syntheticGoalProgram(),retained);
  assert.deepEqual(await f.request({action:'goalProgramSupport'}),{status:200,data:{kind:'goal-program-support',version:1}});
  assert.equal((await f.request({action:'goalProgramSupport'},'not-authenticated')).status,401);
  f.repo.goalProgramSupport=async()=>({kind:'goal-program-support',version:2});
  assert.equal((await f.save(value.parts[0])).status,503);assert.equal(f.commits.length,0);
  f.repo.goalProgramSupport=async()=>{throw Object.assign(Error('synthetic old SQL'),{code:'22023'})};
  assert.deepEqual(await f.request({action:'goalProgramSupport'}),{status:400,data:{error:'GOAL_PROGRAM_UNSUPPORTED'}});
  assert.equal((await f.save(value.parts[0])).status,400);assert.equal(f.commits.length,0);
});

test('owner-bound immutable parts precede verified reference index and retain exact receipts',async()=>{
  const f=await fixture(),value=splitAccountGoalProgramCollection(syntheticGoalProgram(),retained);
  assert.deepEqual(await f.save(value.index),{status:409,data:{error:'GOAL_PROGRAM_REFERENCE_UNAVAILABLE'}});
  await f.stage(value);
  const operationId=randomUUID(),first=await f.save(value.index,0,operationId);
  assert.equal(first.status,200);assert.equal(first.data.revision,1);
  assert.deepEqual(await f.save(value.index,0,operationId),first);
  assert.equal(f.commits.length,3,'receipt replay cannot submit a second index commit');
  assert.equal(f.commits[0].metadata.goalProgramPartId,value.parts[0].data.id);
  assert.equal(f.commits[2].metadata.goalProgramParts.length,2);
  assert.ok(f.commits.every(row=>row.metadata.eligible===false&&row.metadata.occurrenceId===null&&row.metadata.journalDate===null));
  assert.ok(!JSON.stringify(f.commits).includes('goalMinutes'),'repository stores hashes, ciphertext and structural metadata only');
  assert.equal((await f.save(value.index,0)).status,409,'stale singleton CAS');
  const foreign=await state.accountGoalProgramDocumentId(other,value.parts[0].kind,value.parts[0].data.id);
  assert.deepEqual(await f.save(value.parts[0],0,randomUUID(),foreign),{status:422,data:{error:'INVALID_DOCUMENT'}});
});

test('immutable body/progress cannot update, delete, restore or substitute a missing owner reference',async()=>{
  const f=await fixture(),value=splitAccountGoalProgramCollection(syntheticGoalProgram(),retained);
  await f.stage(value);
  const id=await state.accountGoalProgramDocumentId(owner,value.parts[0].kind,value.parts[0].data.id);
  assert.deepEqual(await f.save(value.parts[0],1),{status:422,data:{error:'INVALID_DOCUMENT_UPDATE'}});
  for(const action of ['delete','restore']) assert.deepEqual(await f.request({action,documentId:id,operationId:randomUUID(),expectedRevision:1,
    ...(action==='restore'?{sourceRevision:1}:{})}),{status:422,data:{error:'INVALID_DOCUMENT_UPDATE'}});
  const progressId=await state.accountGoalProgramDocumentId(owner,value.parts[1].kind,value.parts[1].data.id);
  const row=f.rows.get(f.key(owner,progressId));
  f.rows.delete(f.key(owner,progressId));f.rows.set(f.key(other,progressId),{...row,user_id:other});
  assert.deepEqual(await f.save(value.index),{status:409,data:{error:'GOAL_PROGRAM_REFERENCE_UNAVAILABLE'}});
});

test('old draft and journal readers ignore monthly account-state documents',async()=>{
  const f=await fixture(),value=splitAccountGoalProgramCollection(syntheticGoalProgram(),retained);
  await f.stage(value);await f.save(value.index);
  const draftId=randomUUID(),draft={version:1,state:'DRAFT',visibility:'PRIVATE',date:'2026-10-10',title:'',body:'SYNTHETIC_LEGACY_DRAFT'};
  assert.equal((await f.request({action:'save',documentId:draftId,operationId:randomUUID(),expectedRevision:0,document:draft})).status,200);
  const old=await f.request({action:'list'});
  assert.equal(old.status,200);assert.deepEqual(old.data.documents.map(row=>row.document),[draft]);
  const journal=await f.request({action:'list',collection:'JOURNAL'});
  assert.equal(journal.status,200);assert.deepEqual(journal.data.documents,[]);
  assert.equal((await f.request({action:'read',documentId:draftId})).status,200);
});

test('index replacement cannot silently discard an acknowledged original or history',async()=>{
  const f=await fixture(),old=syntheticGoalProgram(),value=splitAccountGoalProgramCollection(old,retained);
  await f.stage(value);await f.save(value.index);
  const replacement=splitAccountGoalProgramCollection(syntheticGoalProgram(1),retained);
  await f.stage(replacement);
  assert.deepEqual(await f.save(replacement.index,1),{status:422,data:{error:'INVALID_DOCUMENT_UPDATE'}});
  const next=syntheticGoalProgram(1);next.revision=1;
  const preserved=splitAccountGoalProgramCollection(next,{version:1,entries:[{archivedAt:'2026-10-10T01:00:00.000Z',document:old}]});
  await f.stage({parts:preserved.parts.filter(part=>part.kind==='GOAL_PROGRAM_PROGRESS'&&part.data.programId===next.program.programId)});
  assert.equal((await f.save(preserved.index,1)).status,200);
});
