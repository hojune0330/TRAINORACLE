import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { accountPlanDocumentSchema, accountPlanEntry, accountPlanFingerprint, emptyAccountPlanDocument, materializeAccountPlan,
  validateAccountPlanDocument, validateAccountPlanDocumentUpdate, validateAccountPlanPacket } from "./account-plan-document-schema"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { readAccountPlanEntry } from "./account-plan-service"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./local-journal-ownership"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it.each([2, 3, 4, 5, 6] as const)("V%s restores the exact historical body and progress without local originals or execution authority", version => {
  const packet = accountPlanPacketFixture(version), entry = accountPlanEntry(packet)
  const state = packet.state.version === 2 || packet.state.version === 3 ? packet.state : packet.state.selection
  entry.progress = [{ sessionDay: state.activePlan.sessions[0]!.day, sessionSlot: state.activePlan.sessions[0]!.slot, state: "COMPLETED" }]
  const document = emptyAccountPlanDocument()
  document.data.plans.push(entry)
  if (version !== 2) document.data.currentPlanId = entry.planId
  expect(validateAccountPlanDocument(document)).toBe(true)
  localStorage.clear()
  const write = vi.spyOn(Storage.prototype, "setItem")
  const read = readAccountPlanEntry(entry, () => packet.evidence ? [packet.evidence] : [])
  expect(read).toMatchObject({ kind: "read_only", executionAuthority: "NONE", packet: { state: { version, progress: entry.progress } } })
  expect(validateAccountPlanPacket(materializeAccountPlan(entry))).toBe(true)
  expect(write).not.toHaveBeenCalled()
  expect(entry.snapshot.state.progress).toEqual([])
})

it("keeps V2 historical-only and rejects it as the current account plan", () => {
  const packet = accountPlanPacketFixture(2), entry = accountPlanEntry(packet)
  const document = emptyAccountPlanDocument()
  document.data.plans.push(entry)
  expect(validateAccountPlanDocument(document)).toBe(true)
  document.data.currentPlanId = entry.planId
  expect(validateAccountPlanDocument(document)).toBe(false)
})

it.each([4, 5, 6] as const)("V%s transported evidence cannot manufacture independently retained authority", version => {
  const packet = accountPlanPacketFixture(version), entry = accountPlanEntry(packet)
  expect(readAccountPlanEntry(entry)).toMatchObject({ kind: "evidence_required", executionAuthority: "NONE" })
  expect(readAccountPlanEntry(entry, () => [packet.evidence!, packet.evidence!]).kind).toBe("evidence_required")
  const changed = structuredClone(packet)
  Reflect.set(changed.evidence!, "policies", [])
  expect(validateAccountPlanPacket(changed)).toBe(false)
  Reflect.set(packet.state, "memo", "must not be transported")
  expect(validateAccountPlanPacket(packet)).toBe(false)
})

it("rejects arbitrary data, dangling pointers, duplicate slots and unknown nested fields", () => {
  const doc = emptyAccountPlanDocument(), entry = accountPlanEntry(accountPlanPacketFixture(3))
  expect(validateAccountPlanDocument(doc)).toBe(true)
  expect(validateAccountPlanDocument({ ...doc, data: { payload: "anything" } })).toBe(false)
  doc.data.currentPlanId = entry.planId
  expect(validateAccountPlanDocument(doc)).toBe(false)
  doc.data.plans.push(entry)
  expect(validateAccountPlanDocument(doc)).toBe(true)
  entry.progress = [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }, { sessionDay: 1, sessionSlot: "AM", state: "SKIPPED" }]
  expect(validateAccountPlanDocument(doc)).toBe(false)
  entry.progress = [{ sessionDay: 99, sessionSlot: "AM", state: "COMPLETED" }]
  expect(validateAccountPlanDocument(doc)).toBe(false)
  entry.progress = []
  Reflect.set(entry.snapshot, "executionAuthority", "GRANTED")
  expect(validateAccountPlanDocument(doc)).toBe(false)
})

it("keeps immutable snapshots and archived originals across updates", () => {
  const doc = emptyAccountPlanDocument(), entry = accountPlanEntry(accountPlanPacketFixture(3))
  doc.data.plans.push(entry); doc.data.currentPlanId = entry.planId
  const archived = structuredClone(doc)
  archived.data.currentPlanId = null; archived.data.plans[0]!.archivedAt = TODAY.toISOString()
  expect(validateAccountPlanDocumentUpdate(doc, archived)).toBe(true)
  expect(validateAccountPlanDocumentUpdate(archived, doc)).toBe(false)
  expect(validateAccountPlanDocumentUpdate(doc, emptyAccountPlanDocument())).toBe(false)
  const changed = structuredClone(doc)
  Reflect.set(changed.data.plans[0]!.snapshot.state, "generatedAt", "2026-07-25T00:00:00.000Z")
  changed.data.plans[0]!.planId = accountPlanFingerprint(changed.data.plans[0]!.snapshot)
  changed.data.currentPlanId = changed.data.plans[0]!.planId
  expect(validateAccountPlanDocumentUpdate(doc, changed)).toBe(false)
})

it("UTF-8 size guard rejects oversized bytes, not characters (isolated size boundary)", () => {
  vi.spyOn(accountPlanDocumentSchema, "safeParse").mockReturnValue({ success: true, data: emptyAccountPlanDocument() })
  expect(validateAccountPlanDocument({ text: "a".repeat(170_000) })).toBe(true)
  const large = { text: "가".repeat(170_000) }
  expect(JSON.stringify(large).length).toBeLessThan(500_000)
  expect(new TextEncoder().encode(JSON.stringify(large)).byteLength).toBeGreaterThan(500_000)
  expect(validateAccountPlanDocument(large)).toBe(false)
})
