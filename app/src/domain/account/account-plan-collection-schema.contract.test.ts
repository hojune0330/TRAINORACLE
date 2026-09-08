import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import {
  ACCOUNT_PLAN_MAX_BYTES, accountPlanDocumentSchema, accountPlanEntry, accountPlanFingerprint, emptyAccountPlanDocument,
  validateAccountPlanDocument, type AccountPlanDocument,
} from "./account-plan-document-schema"
import { readAccountPlanEntry } from "./account-plan-service"
import {
  joinAccountPlanCollection, splitAccountPlanCollection, type AccountPlanCollectionParts,
} from "./account-plan-collection-schema"

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(TODAY.getTime() + 120_000)) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.account-plan-collection.v1", value)
const copy = <T>(value: T): T => structuredClone(value)

// Same real versioned packets and distinct timestamps as the existing capacity fixture.
function fixture(version: 3 | 4 | 5 | 6 = 3, count = 2): AccountPlanDocument {
  const document = emptyAccountPlanDocument()
  for (let i = 0; i < count; i++) {
    localStorage.clear()
    const entry = accountPlanEntry(accountPlanPacketFixture(version, new Date(TODAY.getTime() + i * 1000)))
    const state = entry.snapshot.state
    const session = (state.version === 3 ? state.activePlan : state.selection.activePlan).sessions[0]!
    entry.progress = [{ sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" }]
    if (i < count - 1) entry.archivedAt = new Date().toISOString()
    document.data.plans.push(entry)
  }
  document.data.currentPlanId = document.data.plans.at(-1)?.planId ?? null
  return document
}

function freeze(value: unknown): void {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
}

it("round trips empty and V3 collections with detached data and no source mutation", () => {
  expect(joinAccountPlanCollection(splitAccountPlanCollection(emptyAccountPlanDocument()))).toEqual(emptyAccountPlanDocument())
  const source = fixture(), before = copy(source)
  freeze(source)
  const parts = splitAccountPlanCollection(source), partsBefore = copy(parts)
  freeze(parts)
  const result = joinAccountPlanCollection(parts)!
  expect(result).toEqual(before)
  result.data.plans[0]!.progress.length = 0
  Reflect.set(result.data.plans[0]!.snapshot.state, "generatedAt", "changed")
  expect(source).toEqual(before)
  expect(parts).toEqual(partsBefore)
  expect(splitAccountPlanCollection(source)).toEqual(parts)
})

it.each([4, 5, 6] as const)("V%s retains 18 real frames where the monolith fails", version => {
  const document = fixture(version, 18), before = copy(document)
  expect(validateAccountPlanDocument(document)).toBe(false)
  expect(bytes(document)).toBeGreaterThan(ACCOUNT_PLAN_MAX_BYTES)
  const splitStart = performance.now()
  const parts = splitAccountPlanCollection(document)
  const splitMs = performance.now() - splitStart, joinStart = performance.now()
  const joined = joinAccountPlanCollection(parts)
  const joinMs = performance.now() - joinStart
  expect(joined).toEqual(document)
  expect(document).toEqual(before)
  expect(parts.snapshots).toHaveLength(18)
  expect(parts.progress).toHaveLength(18)
  for (const part of [parts.index, ...parts.snapshots, ...parts.progress]) expect(bytes(part)).toBeLessThanOrEqual(ACCOUNT_PLAN_MAX_BYTES)
  expect(bytes(parts.index)).toBeLessThan(20_000)
  expect(parts.snapshots.every(part => part.snapshot.state.progress.length === 0)).toBe(true)
  expect(readAccountPlanEntry(joined!.data.plans[0]!)).toMatchObject({
    kind: "evidence_required", executionAuthority: "NONE",
  })
  console.info(`COLLECTION V${version}: logical=${bytes(document)} index=${bytes(parts.index)} maxPart=${Math.max(...parts.snapshots.map(bytes), ...parts.progress.map(bytes))} splitMs=${splitMs.toFixed(0)} joinMs=${joinMs.toFixed(0)}`)
}, 60_000)

it.each([3, 4, 5, 6] as const)("V%s round trips all 100 retained real frames without trimming", version => {
  const document = fixture(version, 100), parts = splitAccountPlanCollection(document)
  expect(parts.index.plans).toHaveLength(100)
  expect(joinAccountPlanCollection(parts)).toEqual(document)
  expect(bytes(parts.index)).toBeLessThan(100_000)
  for (const part of [...parts.snapshots, ...parts.progress]) expect(bytes(part)).toBeLessThanOrEqual(ACCOUNT_PLAN_MAX_BYTES)
}, 120_000)

it("keeps snapshots stable and makes progress/archive revisions content addressed", () => {
  const document = fixture(), original = splitAccountPlanCollection(document)
  document.data.plans[1]!.progress = []
  const next = splitAccountPlanCollection(document)
  expect(next.snapshots).toEqual(original.snapshots)
  expect(next.progress[0]).toEqual(original.progress[0])
  expect(next.progress[1]!.id).not.toBe(original.progress[1]!.id)
  expect(next.index.plans[1]!.progressHash).not.toBe(original.index.plans[1]!.progressHash)
  const { id, ...revision } = next.progress[1]!
  expect(id).toBe(hash(revision))
  document.data.currentPlanId = null
  document.data.plans[1]!.archivedAt = new Date().toISOString()
  const archived = splitAccountPlanCollection(document)
  expect(archived.snapshots).toEqual(original.snapshots)
  expect(archived.progress[1]!.id).not.toBe(next.progress[1]!.id)
  expect(joinAccountPlanCollection(original)).not.toEqual(document)
  expect(joinAccountPlanCollection(archived)).toEqual(document)
})

it("accepts unordered physical parts but preserves index history order", () => {
  const document = fixture(), parts = splitAccountPlanCollection(document)
  parts.snapshots.reverse(); parts.progress.reverse()
  expect(joinAccountPlanCollection(parts)).toEqual(document)
  parts.index.plans.reverse()
  expect(joinAccountPlanCollection(parts)).toBeNull()
})

const corruptions: [string, (parts: AccountPlanCollectionParts) => void][] = [
  ["missing snapshot", p => { p.snapshots.pop() }],
  ["missing progress", p => { p.progress.pop() }],
  ["extra snapshot", p => { p.snapshots.push(copy(p.snapshots[0]!)) }],
  ["extra progress", p => { p.progress.push(copy(p.progress[0]!)) }],
  ["duplicate snapshot", p => { p.snapshots[1] = copy(p.snapshots[0]!) }],
  ["duplicate progress", p => { p.progress[1] = copy(p.progress[0]!) }],
  ["duplicate reference", p => { p.index.plans[1] = copy(p.index.plans[0]!) }],
  ["missing reference", p => { p.index.plans.pop() }],
  ["wrong snapshot ref", p => { p.index.plans[0]!.snapshotId = p.index.plans[1]!.snapshotId }],
  ["wrong progress ref", p => { p.index.plans[0]!.progressId = p.index.plans[1]!.progressId }],
  ["wrong plan ID", p => { p.progress[0]!.planId = p.progress[1]!.planId }],
  ["wrong snapshot binding", p => { p.progress[0]!.snapshotId = p.snapshots[1]!.id }],
  ["wrong snapshot hash", p => { p.index.plans[0]!.snapshotHash = p.index.plans[1]!.snapshotHash }],
  ["wrong progress hash", p => { p.index.plans[0]!.progressHash = p.index.plans[1]!.progressHash }],
  ["tampered progress", p => { p.progress[0]!.progress = [] }],
  ["removed defaultable progress slot", p => { Reflect.deleteProperty(p.progress[0]!.progress[0]!, "sessionSlot") }],
  ["tampered archive", p => { p.progress[0]!.archivedAt = null }],
  ["tampered updatedAt", p => { p.progress[0]!.updatedAt = TODAY.toISOString() }],
  ["tampered snapshot", p => { Reflect.set(p.snapshots[0]!.snapshot.state, "generatedAt", TODAY.toISOString().replace(".000", ".001")) }],
  ["tampered pointer", p => { p.index.currentPlanId = null }],
  ["unknown index field", p => { Reflect.set(p.index, "authority", "GRANTED") }],
  ["unknown part field", p => { Reflect.set(p.progress[0]!, "extra", true) }],
  ["unknown wrapper field", p => { Reflect.set(p, "extra", true) }],
]
it.each(corruptions)("rejects %s", (_name, corrupt) => {
  const parts = splitAccountPlanCollection(fixture())
  corrupt(parts)
  expect(joinAccountPlanCollection(parts)).toBeNull()
})

it.each([4, 5, 6] as const)("V%s rejects changed evidence", version => {
  const parts = splitAccountPlanCollection(fixture(version, 1))
  Reflect.set(parts.snapshots[0]!.snapshot.evidence!, "policies", [])
  expect(joinAccountPlanCollection(parts)).toBeNull()
})

it.each([4, 5, 6] as const)("V%s fully validates packets even after all tampered evidence hashes are recomputed", version => {
  const document = fixture(version, 1), parts = splitAccountPlanCollection(document)
  const entry = document.data.plans[0]!, snapshot = parts.snapshots[0]!, progress = parts.progress[0]!
  Reflect.set(entry.snapshot.evidence!, "policies", [])
  entry.planId = accountPlanFingerprint(entry.snapshot)
  document.data.currentPlanId = entry.planId
  snapshot.snapshot = copy(entry.snapshot); snapshot.planId = entry.planId
  snapshot.id = hash({ kind: "PLAN_SNAPSHOT", planId: entry.planId })
  progress.planId = entry.planId; progress.snapshotId = snapshot.id
  const { id: _id, ...revision } = progress
  progress.id = hash(revision)
  parts.index.plans[0] = { planId: entry.planId, snapshotId: snapshot.id, snapshotHash: hash(snapshot),
    progressId: progress.id, progressHash: hash(progress) }
  parts.index.currentPlanId = entry.planId; parts.index.documentFingerprint = hash(document)
  expect(joinAccountPlanCollection(parts)).toBeNull()
})

it("still validates logical progress and current/archive lineage even with recomputed hashes", () => {
  const document = fixture(), parts = splitAccountPlanCollection(document)
  document.data.plans[0]!.progress = [{ sessionDay: 99, sessionSlot: "AM", state: "COMPLETED" }]
  parts.progress[0]!.progress = document.data.plans[0]!.progress
  const { id: _id, ...revision } = parts.progress[0]!
  parts.progress[0]!.id = hash(revision)
  parts.index.plans[0]!.progressId = parts.progress[0]!.id
  parts.index.plans[0]!.progressHash = hash(parts.progress[0])
  parts.index.documentFingerprint = hash(document)
  expect(joinAccountPlanCollection(parts)).toBeNull()
  expect(() => splitAccountPlanCollection(document)).toThrow("Invalid account plan collection source")
  const valid = fixture(), archivedPointer = splitAccountPlanCollection(valid)
  valid.data.currentPlanId = valid.data.plans[0]!.planId
  archivedPointer.index.currentPlanId = valid.data.currentPlanId
  archivedPointer.index.documentFingerprint = hash(valid)
  expect(joinAccountPlanCollection(archivedPointer)).toBeNull()
})

it("rejects 101 refs and noncanonical/unknown logical input", () => {
  const source = fixture(3, 101)
  expect(() => splitAccountPlanCollection(source)).toThrow()
  const parts = splitAccountPlanCollection(fixture())
  parts.index.plans = Array.from({ length: 101 }, () => copy(parts.index.plans[0]!))
  expect(joinAccountPlanCollection(parts)).toBeNull()
  for (const value of [null, undefined, {}, [], { ...parts, extra: undefined }]) expect(joinAccountPlanCollection(value)).toBeNull()
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic
  expect(joinAccountPlanCollection(cyclic)).toBeNull()
  const invalid = fixture()
  Reflect.set(invalid, "extra", true)
  expect(() => splitAccountPlanCollection(invalid)).toThrow()
})

it("counts UTF-8 physical bytes including envelopes at the exact 500000 boundary (isolated size gate)", () => {
  const source = fixture(3, 1), baseline = splitAccountPlanCollection(source)
  // Isolate capacity from packet field limits, as in the existing document size contract.
  Reflect.set(source.data.plans[0]!.snapshot, "padding", "")
  Reflect.set(baseline.snapshots[0]!.snapshot, "padding", "")
  vi.spyOn(accountPlanDocumentSchema, "safeParse").mockImplementation(() => ({ success: true, data: source }))
  const room = ACCOUNT_PLAN_MAX_BYTES - bytes(baseline.snapshots[0])
  Reflect.set(source.data.plans[0]!.snapshot, "padding", "a".repeat(room))
  expect(bytes(splitAccountPlanCollection(source).snapshots[0])).toBe(ACCOUNT_PLAN_MAX_BYTES)
  Reflect.set(source.data.plans[0]!.snapshot, "padding", "a".repeat(room + 1))
  expect(() => splitAccountPlanCollection(source)).toThrow("exceeds byte capacity")
  Reflect.set(source.data.plans[0]!.snapshot, "padding", "\uac00".repeat(170_000))
  expect(JSON.stringify(source).length).toBeLessThan(ACCOUNT_PLAN_MAX_BYTES)
  expect(() => splitAccountPlanCollection(source)).toThrow("exceeds byte capacity")
  expect(joinAccountPlanCollection({ ...baseline, index: { ...baseline.index, padding: "\uac00".repeat(170_000) } })).toBeNull()
})
