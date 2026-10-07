import { beforeEach, expect, it, vi } from "vitest"
import { accountPlanPacketFixture } from "./account/account-plan.test-fixtures"
import { accountPlanEntry, emptyAccountPlanDocument } from "./account/account-plan-document-schema"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { readJournalOriginalPlan } from "./journal-original-plan"
import { readPlanBetaStateFromStorage } from "./plan-beta-store"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"

const runtime = vi.hoisted(() => ({ snapshot: vi.fn((): unknown => null) }))

vi.mock("./account/account-plan-service", async importOriginal => ({
  ...await importOriginal<typeof import("./account/account-plan-service")>(),
  accountPlansEnabled: () => true,
  accountPlanService: () => ({ snapshot: runtime.snapshot }),
}))

function accountView(packet: ReturnType<typeof accountPlanPacketFixture>) {
  return {
    document: {},
    currentPlan: { kind: "read_only" as const, packet },
  }
}

beforeEach(() => {
  setActiveLocalAccount(null)
  window.localStorage.clear()
  window.sessionStorage.clear()
  runtime.snapshot.mockReset()
})

it("does not read multi-plan evidence for an account V3 plan", () => {
  const packet = accountPlanPacketFixture(3)
  const readMultiEvidence = vi.fn(() => [])
  runtime.snapshot.mockClear()
  runtime.snapshot.mockReturnValue(accountView(packet))

  expect(readPlanBetaStateFromStorage([], [], readMultiEvidence)).toEqual({ kind: "loaded", state: packet.state })
  expect(readMultiEvidence).not.toHaveBeenCalled()
  expect(runtime.snapshot).toHaveBeenCalledOnce()
})

it("reads account multi-plan evidence once and resnapshots the service", () => {
  const packet = accountPlanPacketFixture(6)
  if (packet.evidence === null || !("slots" in packet.evidence) || !("rpeBindings" in packet.evidence)) throw Error("Expected V6 evidence")
  const evidence = packet.evidence as RetainedMultiAdjustedEvidenceV3
  const readMultiEvidence = vi.fn(() => [evidence])
  runtime.snapshot.mockClear()
  runtime.snapshot.mockReturnValue(accountView(packet))

  expect(readPlanBetaStateFromStorage([], [], readMultiEvidence)).toMatchObject({
    kind: "multi_adjusted_v3_loaded",
    state: packet.state,
  })
  expect(readMultiEvidence).toHaveBeenCalledOnce()
  expect(runtime.snapshot).toHaveBeenCalledTimes(2)
})

it("fails closed when account multi-plan evidence cannot be read", () => {
  const packet = accountPlanPacketFixture(6)
  runtime.snapshot.mockClear()
  runtime.snapshot.mockReturnValue(accountView(packet))
  const readMultiEvidence = vi.fn((): never => { throw Error("evidence unavailable") })

  expect(readPlanBetaStateFromStorage([], [], readMultiEvidence)).toEqual({ kind: "invalid" })
  expect(readMultiEvidence).toHaveBeenCalledOnce()
  expect(runtime.snapshot).toHaveBeenCalledOnce()
})

it.each(["switch", "aba"] as const)("does not return an old account journal original after an evidence-reader %s", mode => {
  const packet = accountPlanPacketFixture(6)
  if (packet.state.version !== 6 || packet.evidence === null || !("slots" in packet.evidence)
      || !("rpeBindings" in packet.evidence)) throw Error("Expected V6 evidence")
  const evidence = packet.evidence as RetainedMultiAdjustedEvidenceV3
  const session = packet.state.selection.activePlan.sessions.find(candidate => candidate.prescription.kind === "ADJUSTED_METHOD_V3")
  if (session === undefined) throw Error("Expected V6 session")
  const draft = createPlannedSessionLogDraft(packet.state.selection, session, packet.state.selection.generatedAt)
  if (draft === null) throw Error("Expected linked V6 journal")
  const entry = accountPlanEntry(packet), empty = emptyAccountPlanDocument()
  const document = { ...empty, data: { ...empty.data, currentPlanId: entry.planId, plans: [entry] } }
  runtime.snapshot.mockClear()
  runtime.snapshot.mockReturnValue({ document, confirmedDocument: document,
    currentPlan: { planId: entry.planId, kind: "read_only", packet } })
  setActiveLocalAccount("scope-a")
  const readMultiEvidence = vi.fn(() => {
    setActiveLocalAccount("scope-b")
    if (mode === "aba") setActiveLocalAccount("scope-a")
    return [evidence]
  })

  expect(readJournalOriginalPlan({ id: `account-v6-${mode}`, date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toEqual({ kind: "unavailable" })
  expect(readMultiEvidence).toHaveBeenCalledOnce()
})

it("does not read unrelated account V6 evidence before a linked V3 history entry", () => {
  const unrelated = accountPlanPacketFixture(6), linked = accountPlanPacketFixture(3)
  if (unrelated.state.version !== 6 || linked.state.version !== 3) throw Error("Expected account fixtures")
  const session = linked.state.activePlan.sessions[0]!
  const draft = createPlannedSessionLogDraft(linked.state, session, linked.state.generatedAt)
  if (draft === null) throw Error("Expected linked V3 journal")
  const unrelatedEntry = accountPlanEntry(unrelated), linkedEntry = accountPlanEntry(linked)
  const empty = emptyAccountPlanDocument()
  const document = { ...empty, data: { ...empty.data, currentPlanId: linkedEntry.planId, plans: [unrelatedEntry, linkedEntry] } }
  runtime.snapshot.mockClear()
  runtime.snapshot.mockReturnValue({ document, confirmedDocument: document,
    currentPlan: { planId: linkedEntry.planId, kind: "read_only", packet: linked } })
  const readMultiEvidence = vi.fn(() => [])

  expect(readJournalOriginalPlan({ id: "account-linked-v3", date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toMatchObject({ kind: "matched", source: "ACTIVE", session })
  expect(readMultiEvidence).not.toHaveBeenCalled()
})

it("returns the current account plan when the service changes during an evidence read", () => {
  const previous = accountPlanPacketFixture(6)
  const current = accountPlanPacketFixture(3)
  if (previous.evidence === null || !("slots" in previous.evidence) || !("rpeBindings" in previous.evidence)) throw Error("Expected V6 evidence")
  const evidence = previous.evidence as RetainedMultiAdjustedEvidenceV3
  runtime.snapshot.mockClear()
  runtime.snapshot.mockReturnValueOnce(accountView(previous)).mockReturnValue(accountView(current))
  const readMultiEvidence = vi.fn(() => [evidence])

  expect(readPlanBetaStateFromStorage([], [], readMultiEvidence)).toEqual({ kind: "loaded", state: current.state })
  expect(readMultiEvidence).toHaveBeenCalledOnce()
  expect(runtime.snapshot).toHaveBeenCalledTimes(2)
})
