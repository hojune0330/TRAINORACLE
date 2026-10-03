import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AthleteRecord } from "../athlete-records"
import { generatePlanFromDraft, selectPlanForActivation } from "../plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "../catalog-plan-binding"
import { prepareInitialRecordPaces } from "../initial-record-pace"
import { readAccountAthleteRecordsState, type AccountAthleteRecordsState } from "./account-athlete-record-service"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { captureAccountPlanPaceSource, accountPlanPaceSourceStillCurrent } from "./account-plan-pace-source"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { createAccountPlanCollectionService } from "./account-plan-collection-service"
import { COLLECTION_OWNER, collectionMemoryBuffers, collectionServer } from "./account-plan-collection.test-support"
import { validateAccountPlanPacket, type AccountPlanPacket } from "./account-plan-document-schema"
import { PACE_MUTATIONS, paceMutationFixture } from "./account-plan-pace-mutations.test-fixture"

vi.mock("./account-athlete-record-service", () => ({
  readAccountAthleteRecordsState: vi.fn(), ACCOUNT_ATHLETE_RECORD_EVENT: "test:records",
}))
const ID = "44444444-4444-4444-8444-444444444444"
const record: AthleteRecord = { schemaVersion: 1, id: "recent", purpose: "RECENT_RESULT",
  eventDistanceM: 5000, performanceSeconds: 1000, achievedOn: "2026-10-01", seasonId: null,
  enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: "athlete-record:recent",
  savedAt: "2026-10-02T00:00:00.000Z" }
let source: AccountAthleteRecordsState
function packet(): AccountPlanPacket {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY",
    requestedFrameLength: 9, trainingFocus: "LT_INTENT", secondSessionMode: "RECOVERY_PM_ALLOWED",
    trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null, startDate: "2026-10-02" }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error("generation")
  let generated = result.generated
  for (const session of generated.candidates[0]!.sessions.filter(s => s.role === "QUALITY")) {
    const next = replaceCandidateCatalogWorkout(generated, session, "P-LT-B-480", {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [],
    }, true)
    if (!next) throw Error("binding")
    generated = next
  }
  const offer = prepareInitialRecordPaces(generated, [record], "2026-10-02")
  if (!offer) throw Error("offer")
  const selected = selectPlanForActivation(offer.generated.candidates[0]!.candidateId, offer.generated,
    result.gate, result.intake, result.athleteEvidence)
  if (selected.kind !== "selected") throw Error(`selection: ${selected.code}`)
  const value = { state: selected.state, evidence: null }
  if (!validateAccountPlanPacket(value)) throw Error("packet")
  return value
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-02T03:00:00Z"))
  localStorage.clear(); setActiveLocalAccount(COLLECTION_OWNER)
  source = { ownerId: COLLECTION_OWNER, status: "READY", confirmed: true, documentId: ID,
    serverRevision: 3, records: [structuredClone(record)] }
  vi.mocked(readAccountAthleteRecordsState).mockImplementation(() => source)
})
afterEach(() => { setActiveLocalAccount(null); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it("captures confirmed server revision and detects later source revision changes", () => {
  const value = packet(), captured = captureAccountPlanPaceSource(value, COLLECTION_OWNER)
  expect(captured).toEqual({ kind: "ready", guard: { documentId: ID, revision: 3 } })
  expect(accountPlanPaceSourceStillCurrent(value, COLLECTION_OWNER, captured)).toBe(true)
  source.serverRevision = 4
  expect(accountPlanPaceSourceStillCurrent(value, COLLECTION_OWNER, captured)).toBe(false)
})
it.each(["PENDING", "DELETED", "LOADING", "CONFLICT", "FAILED"] as const)("rejects %s source", status => {
  const value = packet(); source.status = status
  expect(captureAccountPlanPaceSource(value, COLLECTION_OWNER).kind).toBe("unavailable")
})
it.each(["missing", "changed", "duplicate", "unverified", "unconfirmed", "owner"])("rejects %s source facts", change => {
  const value = packet()
  if (change === "missing") source.records = []
  if (change === "changed") source.records = [{ ...record, performanceSeconds: 900 }]
  if (change === "duplicate") source.records = [record, record]
  if (change === "unverified") source.records = [{ ...record, verificationState: "UNVERIFIED" }]
  if (change === "unconfirmed") source.confirmed = false
  if (change === "owner") setActiveLocalAccount("another-account")
  expect(captureAccountPlanPaceSource(value, COLLECTION_OWNER).kind).toBe("unavailable")
})
it("accepts a record-free plan without a fabricated guard", () => {
  source.status = "FAILED"
  expect(captureAccountPlanPaceSource(accountPlanPacketFixture(3), COLLECTION_OWNER)).toEqual({ kind: "none" })
})
it.each([4, 5, 6] as const)("does not invent a guard for v%i sessions without supported record bindings", version => {
  setActiveLocalAccount(null)
  const value = accountPlanPacketFixture(version)
  setActiveLocalAccount(COLLECTION_OWNER)
  source.status = "PENDING"
  expect(captureAccountPlanPaceSource(value, COLLECTION_OWNER).kind).toBe("none")
})

function serviceFixture() {
  const server = collectionServer(), stores = collectionMemoryBuffers()
  const service = createAccountPlanCollectionService({ ownerId: COLLECTION_OWNER, isCurrent: () => true,
    runExclusive: async run => run(), client: server.client, buffers: stores.dependencies,
    legacyBuffer: stores.legacy.buffer, yieldTask: async () => {} })
  return { server, service }
}
it.each([false, true])("carries confirmed source guard on selection (existing current: %s)", async successor => {
  const { server, service } = serviceFixture(); await service.hydrate()
  if (successor) {
    expect(await service.mutate({ kind: "SELECT", packet: accountPlanPacketFixture(3),
      confirmsSelection: true, freshReview: () => true }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  }
  const previous = server.index()
  expect(await service.mutate({ kind: "SELECT", packet: packet(), confirmsSelection: true,
    freshReview: () => true }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(server.commits.at(-1)).toMatchObject({ paceRecordGuard: { documentId: ID, revision: 3 },
    previousCurrentPlanId: previous?.currentPlanId ?? null })
})
it("fails closed when confirmed source changes during staging", async () => {
  const { server, service } = serviceFixture(); await service.hydrate()
  const stage = vi.mocked(server.client.stage).getMockImplementation()!
  vi.mocked(server.client.stage).mockImplementation(async (...args) => {
    source.serverRevision = 4
    return stage(...args)
  })
  const result = await service.mutate({ kind: "SELECT", packet: packet(), confirmsSelection: true,
    freshReview: () => true }, service.snapshot().fingerprint!)
  expect(["STALE", "REVIEW_REQUIRED"]).toContain(result)
  expect(server.commits).toHaveLength(0)
})
it("rejects caller guard metadata that disagrees with confirmed source", async () => {
  const { server, service } = serviceFixture(); await service.hydrate()
  expect(await service.mutate({ kind: "SELECT", packet: packet(), confirmsSelection: true,
    freshReview: () => true, paceRecordGuard: { documentId: ID, revision: 2 } }, service.snapshot().fingerprint!))
    .toBe("REVIEW_REQUIRED")
  expect(server.commits).toHaveLength(0)
})

it.each(PACE_MUTATIONS)("guards %s new uses while leaving same-slot historical references intact", async kind => {
  const seed = paceMutationFixture(kind)
  vi.setSystemTime(new Date(seed.now))
  source.records = [seed.record, seed.historical]
  const { server, service } = serviceFixture(); await service.hydrate()
  expect(await service.mutate({ kind: "SELECT", packet: { state: seed.before, evidence: null },
    confirmsSelection: true, freshReview: () => true }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  source.records = [seed.record]; source.serverRevision = 4
  const packet = { state: seed.after, evidence: null }
  expect(validateAccountPlanPacket(packet)).toBe(true)
  expect(captureAccountPlanPaceSource(packet, COLLECTION_OWNER)).toEqual({ kind: "ready", guard: { documentId: ID, revision: 4 } })
  expect(await service.mutate({ kind: "SELECT", packet, confirmsSelection: true,
    freshReview: () => true }, service.snapshot().fingerprint!)).toBe("ACCOUNT")
  expect(server.commits.at(-1)).toMatchObject({ paceRecordGuard: { documentId: ID, revision: 4 } })
})

it.each(PACE_MUTATIONS)("rejects stale, deleted, or foreign %s sources without substituting device records", kind => {
  const seed = paceMutationFixture(kind, true)
  vi.setSystemTime(new Date(seed.now)); source.records = [seed.record]
  const packet = { state: seed.after, evidence: null }
  const captured = captureAccountPlanPaceSource(packet, COLLECTION_OWNER)
  expect(captured.kind).toBe("ready")
  source.serverRevision = 4
  expect(accountPlanPaceSourceStillCurrent(packet, COLLECTION_OWNER, captured)).toBe(false)
  source.records = []
  expect(captureAccountPlanPaceSource(packet, COLLECTION_OWNER).kind).toBe("unavailable")
  source.records = [{ ...seed.record, purpose: "RECENT_RESULT", achievedOn: "2026-09-28" }]
  expect(captureAccountPlanPaceSource(packet, COLLECTION_OWNER).kind).toBe("unavailable")
  source.records = [seed.record]; setActiveLocalAccount("another-account")
  expect(captureAccountPlanPaceSource(packet, COLLECTION_OWNER).kind).toBe("unavailable")
})
