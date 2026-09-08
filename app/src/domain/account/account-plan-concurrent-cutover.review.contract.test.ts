import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TODAY } from '../prescription-quality-matrix.test-fixtures'
import { accountPlanPacketFixture } from './account-plan.test-fixtures'
import { accountPlanEntry, emptyAccountPlanDocument, type AccountPlanDocument } from './account-plan-document-schema'
import { createAccountPlanService } from './account-plan-service'
import { createAccountPlanCollectionService } from './account-plan-collection-service'
import { COLLECTION_OWNER, collectionMemoryStore, collectionMemoryBuffers, collectionServer } from './account-plan-collection.test-support'

beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);localStorage.clear();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(TODAY.getTime()+120000))})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()})

it('REPRO explicit SERVER recovery archives old pending when another device already created the collection',async()=>{
  const oldStore=collectionMemoryStore<AccountPlanDocument>()
  const old=createAccountPlanService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,buffer:oldStore.buffer,
    online:()=>false,send:async()=>({ok:false,code:'NOT_FOUND'})})
  await old.hydrate()
  expect(await old.mutate({kind:'SAVE_HISTORY',packet:accountPlanPacketFixture(3)},old.snapshot().fingerprint!)).toBe('PENDING')
  const pending=structuredClone([...oldStore.rows.values()][0]!.pending)
  const oldView=structuredClone([...oldStore.rows.values()][0]!)
  old.close()
  const remote=emptyAccountPlanDocument();remote.data.plans=[accountPlanEntry(accountPlanPacketFixture(3,new Date(TODAY.getTime()+1000)))];remote.data.currentPlanId=remote.data.plans[0]!.planId
  const server=collectionServer(remote), stores=collectionMemoryBuffers()
  const legacySend=vi.fn(async()=>({ok:false as const,code:'UNAVAILABLE' as const}))
  const service=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,
    client:server.client,buffers:stores.dependencies,legacyBuffer:oldStore.buffer,legacySend,yieldTask:async()=>{}})
  expect(await service.hydrate()).toBe(false)
  const result=await service.recoverLegacyPending(()=>false,'SERVER')
  console.log('REPRO_CONCURRENT_CUTOVER',JSON.stringify({result,legacyPending:service.snapshot().legacyPending,
    status:service.snapshot().status,oldArchived:[...oldStore.archives.values()].flat().length,oldWrites:legacySend.mock.calls.length}))
  expect(legacySend).not.toHaveBeenCalled()
  expect(result).toBe('ACCOUNT')
  expect(service.snapshot().legacyPending).toBe(false)
  expect(service.snapshot().currentPlan?.planId).toBe(remote.data.currentPlanId)
  expect([...oldStore.rows.values()][0]).toEqual(oldView)
  expect(oldStore.buffer.ack).not.toHaveBeenCalled()
  expect(stores.cutovers.writes).toHaveLength(1)
  expect(stores.cutovers.writes[0]!.source.operation).toEqual({operationId:pending!.operationId,
    expectedRevision:pending!.expectedRevision,sequence:pending!.sequence})
  expect(stores.cutovers.writes[0]!.disposition).toBe('SERVER')
  expect(stores.cutovers.writes[0]!.pendingIndex).not.toBeNull()
  service.close()
  const reopened=createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,
    client:server.client,buffers:stores.dependencies,legacyBuffer:oldStore.buffer,legacySend,yieldTask:async()=>{}})
  expect(await reopened.hydrate()).toBe(true)
  expect(reopened.snapshot().legacyPending).toBe(false)
  expect(reopened.snapshot().currentPlan?.planId).toBe(remote.data.currentPlanId)
})
