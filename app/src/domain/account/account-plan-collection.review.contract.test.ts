// Independent adversarial regression cases. Service worker owns fixes from here.
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TODAY } from '../prescription-quality-matrix.test-fixtures'
import { accountPlanPacketFixture } from './account-plan.test-fixtures'
import { accountPlanEntry, emptyAccountPlanDocument } from './account-plan-document-schema'
import { createAccountPlanCollectionService as createService } from './account-plan-collection-service'
const createAccountPlanCollectionService = (input: Parameters<typeof createService>[0]) => createService({ runExclusive: async run => run(), ...input })
import { COLLECTION_OWNER, collectionMemoryBuffers, collectionServer } from './account-plan-collection.test-support'

beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);localStorage.clear();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(TODAY.getTime()+120000))})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()})
const make=(server=collectionServer(),stores=collectionMemoryBuffers())=>({server,stores,service:createAccountPlanCollectionService({ownerId:COLLECTION_OWNER,isCurrent:()=>true,client:server.client,buffers:stores.dependencies,legacyBuffer:stores.legacy.buffer,yieldTask:async()=>{}})})
const select=(packet=accountPlanPacketFixture(3))=>({kind:'SELECT' as const,packet,confirmsSelection:true as const,freshReview:()=>true})

it('REPRO old receipt must not replace already-observed newer server index',async()=>{
  const a=make(); await a.service.hydrate(); a.server.loseResponse()
  expect(await a.service.mutate(select(),a.service.snapshot().fingerprint!)).toBe('PENDING')
  const oldPlan=a.server.index()!.currentPlanId
  const b=make(a.server); await b.service.hydrate()
  expect(await b.service.mutate(select(accountPlanPacketFixture(3,new Date(TODAY.getTime()+1000))),b.service.snapshot().fingerprint!)).toBe('ACCOUNT')
  const latest=a.server.index()!.currentPlanId; expect(latest).not.toBe(oldPlan); expect(a.server.revision()).toBe(2)
  a.service.close(); const reopened=make(a.server,a.stores).service
  expect(await reopened.hydrate()).toBe(true)
  console.log('REPRO_RECEIPT',JSON.stringify({serverRevision:a.server.revision(),localRevision:[...a.stores.manifests.rows.values()][0]!.serverRevision,renderedOld:reopened.snapshot().currentPlan?.planId===oldPlan,renderedLatest:reopened.snapshot().currentPlan?.planId===latest,status:reopened.snapshot().status}))
  expect(reopened.snapshot().currentPlan?.planId).toBe(latest)
  expect([...a.stores.manifests.rows.values()][0]!.serverRevision).toBe(2)
  expect(a.server.commits).toHaveLength(2)
  expect(await reopened.loadHistory()).toBe(true)
  expect(reopened.snapshot().document?.data.plans).toHaveLength(2)
  expect(await reopened.mutate({kind:'ARCHIVE',planId:latest!},reopened.snapshot().fingerprint!)).toBe('ACCOUNT')
  expect(a.server.commits.at(-1)!.expectedRevision).toBe(2)
})

it('REPRO stale legacy CAS has no actionable rebase or accept-server recovery',async()=>{
  const doc=emptyAccountPlanDocument(); doc.data.plans=[accountPlanEntry(accountPlanPacketFixture(3))];doc.data.currentPlanId=doc.data.plans[0]!.planId
  const a=make();a.server.setLegacy(doc,1);await a.service.hydrate();a.server.setLegacy(doc,2)
  expect(await a.service.migrateLegacy()).toBe('CONFLICT')
  const pending=structuredClone([...a.stores.manifests.rows.values()][0]!.pending)
  const partCount=a.stores.parts.rows.size
  const resolution=await a.service.useServerCurrent(a.service.snapshot().fingerprint!)
  expect(a.service.snapshot().migrationRequired).toBe(true)
  expect(a.server.revision()).toBe(0)
  expect([...a.stores.manifests.archives.values()].flat()[0]!.pending).toEqual(pending)
  expect(a.stores.parts.rows.size).toBeGreaterThanOrEqual(partCount)
  const migrateAgain=await a.service.migrateLegacy(); const retry=await a.service.retry()
  const hydrate=await a.service.hydrate();const after=await a.service.migrateLegacy()
  console.log('REPRO_LEGACY',JSON.stringify({resolution,migrateAgain,retry,hydrate,after,status:a.service.snapshot().status,blocked:[...a.stores.manifests.rows.values()][0]!.blocked,sourceRevision:[...a.stores.manifests.rows.values()][0]!.pending?.draft.operation?.legacy?.revision}))
  expect(resolution).toBe('ACCOUNT')
  expect(migrateAgain).toBe('ACCOUNT')
  expect(a.server.commits.at(-1)!.legacy?.revision).toBe(2)
  expect(a.server.commits.at(-1)!.operationId).not.toBe(pending!.operationId)
  expect((await a.server.client.readLegacy())?.document).toEqual(doc)
  expect(a.service.snapshot().migrationRequired).toBe(false)
})

it('gateway REJECTED migration can archive and refresh the legacy source before explicit new operation',async()=>{
  const doc=emptyAccountPlanDocument();doc.data.plans=[accountPlanEntry(accountPlanPacketFixture(3))]
  doc.data.currentPlanId=doc.data.plans[0]!.planId
  const a=make();a.server.setLegacy(doc,1);await a.service.hydrate();a.server.setLegacy(doc,2)
  vi.mocked(a.server.client.commit).mockRejectedValueOnce({code:'REJECTED'})
  expect(await a.service.migrateLegacy()).toBe('CONFLICT')
  const pending=structuredClone([...a.stores.manifests.rows.values()][0]!.pending)
  expect(pending).not.toBeNull()
  expect(await a.service.useServerCurrent(a.service.snapshot().fingerprint!)).toBe('ACCOUNT')
  expect([...a.stores.manifests.archives.values()].flat()[0]!.pending).toEqual(pending)
  expect(a.server.revision()).toBe(0)
  expect(a.service.snapshot().migrationRequired).toBe(true)
  a.service.close()
  const reopened=make(a.server,a.stores).service
  expect(await reopened.hydrate()).toBe(true)
  expect(reopened.snapshot().migrationRequired).toBe(true)
  expect(await reopened.migrateLegacy()).toBe('ACCOUNT')
  expect(a.server.commits.at(-1)!.operationId).not.toBe(pending!.operationId)
  expect(a.server.commits.at(-1)!.legacy?.revision).toBe(2)
  expect((await a.server.client.readLegacy())?.revision).toBe(2)
})
