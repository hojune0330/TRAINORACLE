import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TODAY } from '../prescription-quality-matrix.test-fixtures'
import { accountPlanPacketFixture } from './account-plan.test-fixtures'
import type { AccountPlanDocument } from './account-plan-document-schema'
import type { DraftTransport } from './account-journal-sync'
import { createAccountPlanService } from './account-plan-service'
import { createAccountPlanCollectionService } from './account-plan-collection-service'
import { COLLECTION_OWNER, collectionMemoryStore, collectionMemoryBuffers, collectionServer } from './account-plan-collection.test-support'

beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);localStorage.clear();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(TODAY.getTime()+120000))})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()})

// Both real services share the same owner-scoped old buffer. Encryption belongs to browser QA.
it('REPRO cutover must not report EMPTY while a monolithic local outbox still holds an unsent plan',async()=>{
  const legacyStore=collectionMemoryStore<AccountPlanDocument>()
  const old=createAccountPlanService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,buffer:legacyStore.buffer,
    online:()=>false,send:async request=>request.action==='read'?{ok:false,code:'NOT_FOUND'}:{ok:false,code:'UNAVAILABLE'}})
  expect(await old.hydrate()).toBe(true)
  expect(await old.mutate({kind:'SAVE_HISTORY',packet:accountPlanPacketFixture(3)},old.snapshot().fingerprint!)).toBe('PENDING')
  const before=structuredClone([...legacyStore.rows.values()][0]!)
  expect(before.pending).not.toBeNull();expect(before.draft.data.plans).toHaveLength(1)
  old.close()
  const stores=collectionMemoryBuffers(),server=collectionServer()
  const saves: string[]=[]
  const legacySend:DraftTransport<AccountPlanDocument>=async request=>{
    if(request.action==='read') {
      const legacy=await server.client.readLegacy()
      return legacy?{ok:true,data:{kind:'document',...legacy,documentId:request.documentId}}:{ok:false,code:'NOT_FOUND'}
    }
    if(request.action!=='save')return {ok:false,code:'UNAVAILABLE'}
    saves.push(request.operationId);server.setLegacy(request.document,1)
    return {ok:true,data:{kind:'saved',documentId:request.documentId,operationId:request.operationId,revision:1}}
  }
  const next=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,
    client:server.client,buffers:stores.dependencies,legacyBuffer:legacyStore.buffer,legacySend,yieldTask:async()=>{}})
  expect(await next.hydrate()).toBe(false)
  console.log('REPRO_OLD_OUTBOX',JSON.stringify({newStatus:next.snapshot().status,newTotal:next.snapshot().totalPlans,
    oldPending:[...legacyStore.rows.values()][0]!.pending!==null,oldPlans:[...legacyStore.rows.values()][0]!.draft.data.plans.length}))
  expect([...legacyStore.rows.values()][0]).toEqual(before)
  expect(next.snapshot().status).not.toBe('EMPTY')
  expect(next.snapshot().legacyPending).toBe(true)
  expect(next.snapshot().confirmedDocument).toBeNull()
  expect(await next.migrateLegacy()).toBe('PENDING')
  expect(server.commits).toHaveLength(0)
  expect(await next.recoverLegacyPending()).toBe('ACCOUNT')
  expect(saves).toEqual([before.pending!.operationId])
  expect(next.snapshot().legacyPending).toBe(false)
  expect(next.snapshot().migrationRequired).toBe(true)
  expect(next.snapshot().confirmedDocument).toEqual(before.draft)
  expect([...legacyStore.rows.values()][0]!.state).toBe('DRAFT_ACKNOWLEDGED')
  expect([...legacyStore.rows.values()][0]!.draft).toEqual(before.draft)
  expect(server.commits).toHaveLength(0)
  expect(await next.migrateLegacy()).toBe('ACCOUNT')
  expect(server.commits).toHaveLength(1)
  expect([...legacyStore.rows.values()][0]!.draft).toEqual(before.draft)
})

it('cutover reads only the current owner fixed document and cannot attach another owner pending draft',async()=>{
  const oldStore=collectionMemoryStore<AccountPlanDocument>(), stores=collectionMemoryBuffers(), server=collectionServer()
  const other='22222222-2222-4222-8222-222222222222'
  const old=createAccountPlanService({ownerId:other,isCurrent:()=>true,buffer:oldStore.buffer,
    online:()=>false,send:async()=>({ok:false,code:'NOT_FOUND'})})
  await old.hydrate()
  expect(await old.mutate({kind:'SAVE_HISTORY',packet:accountPlanPacketFixture(3)},old.snapshot().fingerprint!)).toBe('PENDING')
  const before=structuredClone([...oldStore.rows.values()])
  const service=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,
    client:server.client,buffers:stores.dependencies,legacyBuffer:oldStore.buffer,yieldTask:async()=>{}})
  expect(await service.hydrate()).toBe(true)
  expect(service.snapshot()).toMatchObject({status:'EMPTY',legacyPending:false,totalPlans:0})
  expect([...oldStore.rows.values()]).toEqual(before)
})

it('old conflicting work requires explicit server choice and remains in the old encrypted archive',async()=>{
  const oldStore=collectionMemoryStore<AccountPlanDocument>(), stores=collectionMemoryBuffers(), server=collectionServer()
  const old=createAccountPlanService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,buffer:oldStore.buffer,
    online:()=>false,send:async()=>({ok:false,code:'NOT_FOUND'})})
  await old.hydrate()
  await old.mutate({kind:'SAVE_HISTORY',packet:accountPlanPacketFixture(3)},old.snapshot().fingerprint!)
  const pending=structuredClone([...oldStore.rows.values()][0]!.pending)
  const remote=structuredClone([...oldStore.rows.values()][0]!.draft)
  remote.data.plans[0]!.archivedAt=new Date().toISOString()
  server.setLegacy(remote,1)
  const legacySend:DraftTransport<AccountPlanDocument>=async request=>{
    if(request.action==='read')return {ok:true,data:{kind:'document',documentId:request.documentId,revision:1,document:remote}}
    if(request.action==='save')return {ok:true,data:{kind:'conflict',documentId:request.documentId,operationId:request.operationId,currentRevision:1}}
    return {ok:false,code:'UNAVAILABLE'}
  }
  const service=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,client:server.client,
    buffers:stores.dependencies,legacyBuffer:oldStore.buffer,legacySend,yieldTask:async()=>{}})
  expect(await service.hydrate()).toBe(false)
  expect(await service.recoverLegacyPending()).toBe('CONFLICT')
  expect(service.snapshot().legacyPending).toBe(true)
  expect([...oldStore.archives.values()].flat()).toHaveLength(0)
  expect(await service.recoverLegacyPending(()=>false,'SERVER')).toBe('ACCOUNT')
  expect([...oldStore.archives.values()].flat()[0]!.pending).toEqual(pending)
  expect(service.snapshot()).toMatchObject({legacyPending:false,migrationRequired:true})
  expect(service.snapshot().confirmedDocument).toEqual(remote)
  expect(server.commits).toHaveLength(0)
})

it('unsent SELECT with no server source is recoverable as history with no review or forged legacy ACK',async()=>{
  const oldStore=collectionMemoryStore<AccountPlanDocument>(),stores=collectionMemoryBuffers(),server=collectionServer()
  const old=createAccountPlanService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,buffer:oldStore.buffer,
    online:()=>true,send:async request=>request.action==='read'?{ok:false,code:'NOT_FOUND'}:{ok:false,code:'UNAVAILABLE'}})
  await old.hydrate()
  expect(await old.mutate({kind:'SELECT',packet:accountPlanPacketFixture(3),confirmsSelection:true,freshReview:()=>true},old.snapshot().fingerprint!)).toBe('PENDING')
  const before=structuredClone([...oldStore.rows.values()][0]!)
  const legacySend=vi.fn(async()=>({ok:false as const,code:'NOT_FOUND' as const}))
  const service=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,client:server.client,
    buffers:stores.dependencies,legacyBuffer:oldStore.buffer,legacySend,yieldTask:async()=>{}})
  expect(await service.hydrate()).toBe(false)
  expect(service.snapshot()).toMatchObject({legacyPending:true,legacyPendingCount:1,currentPlan:null})
  expect(service.snapshot().legacyPendingPlans[0]).toMatchObject({kind:'read_only',executionAuthority:'NONE'})
  expect(await service.recoverLegacyPending(()=>false,'HISTORY')).toBe('ACCOUNT')
  expect(legacySend).not.toHaveBeenCalled()
  expect(oldStore.buffer.ack).not.toHaveBeenCalled()
  expect([...oldStore.rows.values()][0]).toEqual(before)
  expect(service.snapshot().legacyPending).toBe(false)
  expect(service.snapshot().currentPlan).toBeNull()
  expect(server.index()?.currentPlanId).toBeNull()
  expect(server.index()?.plans).toHaveLength(1)
  expect(await service.loadHistory()).toBe(true)
  expect(service.snapshot().document?.data.plans[0]?.archivedAt).not.toBeNull()
  expect(service.snapshot().document?.data.plans[0]?.snapshot).toEqual(before.draft.data.plans[0]!.snapshot)
  expect(stores.cutovers.writes[0]?.disposition).toBe('HISTORY')
  expect(stores.cutovers.writes[0]?.source.operation?.operationId).toBe(before.pending!.operationId)
  service.close()
  const reopened=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,client:server.client,
    buffers:stores.dependencies,legacyBuffer:oldStore.buffer,legacySend,yieldTask:async()=>{}})
  expect(await reopened.hydrate()).toBe(true)
  expect(reopened.snapshot().legacyPending).toBe(false)
  expect(reopened.snapshot().totalPlans).toBe(1)
})

it('lost history receipt does not write a cutover marker until the exact pending operation is confirmed',async()=>{
  const oldStore=collectionMemoryStore<AccountPlanDocument>(),stores=collectionMemoryBuffers(),server=collectionServer()
  const old=createAccountPlanService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,buffer:oldStore.buffer,
    online:()=>false,send:async()=>({ok:false,code:'NOT_FOUND'})})
  await old.hydrate();await old.mutate({kind:'SAVE_HISTORY',packet:accountPlanPacketFixture(3)},old.snapshot().fingerprint!)
  const before=structuredClone([...oldStore.rows.values()][0]!)
  const service=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,client:server.client,
    buffers:stores.dependencies,legacyBuffer:oldStore.buffer,yieldTask:async()=>{}})
  await service.hydrate();server.loseResponse()
  expect(await service.recoverLegacyPending(()=>false,'HISTORY')).toBe('PENDING')
  expect(stores.cutovers.writes).toHaveLength(0)
  expect(service.snapshot().legacyPending).toBe(true)
  const operation=[...stores.manifests.rows.values()][0]!.pending!.operationId
  expect(await service.recoverLegacyPending(()=>false,'HISTORY')).toBe('ACCOUNT')
  expect(server.commits).toHaveLength(1)
  expect(server.client.receipt).toHaveBeenLastCalledWith(COLLECTION_OWNER,operation)
  expect(stores.cutovers.writes).toHaveLength(1)
  expect([...oldStore.rows.values()][0]).toEqual(before)
})

it('a changed old source invalidates its handoff marker instead of silently skipping new pending work',async()=>{
  const oldStore=collectionMemoryStore<AccountPlanDocument>(),stores=collectionMemoryBuffers(),server=collectionServer()
  const old=createAccountPlanService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,buffer:oldStore.buffer,
    online:()=>false,send:async()=>({ok:false,code:'NOT_FOUND'})})
  await old.hydrate();await old.mutate({kind:'SAVE_HISTORY',packet:accountPlanPacketFixture(3)},old.snapshot().fingerprint!)
  const service=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,client:server.client,
    buffers:stores.dependencies,legacyBuffer:oldStore.buffer,yieldTask:async()=>{}})
  await service.hydrate();expect(await service.recoverLegacyPending(()=>false,'HISTORY')).toBe('ACCOUNT')
  const source=[...oldStore.rows.values()][0]!
  source.localSequence++
  expect(await service.hydrate()).toBe(false)
  expect(service.snapshot().legacyPending).toBe(true)
  expect(stores.cutovers.writes).toHaveLength(1)
})
