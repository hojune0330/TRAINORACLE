import { beforeEach, expect, it, vi } from "vitest"
import { accountPlanPacketFixture } from "./account/account-plan.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { readJournalOriginalPlan } from "./journal-original-plan"
import { activePlanBetaStorageKey, archiveAndClearActivePlan, savePlanBetaState } from "./plan-beta-store"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { ADJUSTED_PLAN_ARCHIVE_KEY } from "./adjusted-plan-archive"
import { ADJUSTED_PLAN_ARCHIVE_V3_KEY } from "./adjusted-plan-archive-v3"
import { hasMultiAdjustedOriginalPlansV3, MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY, prepareMultiAdjustedOriginalArchiveV3 } from "./multi-adjusted-plan-archive-v3"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"

beforeEach(() => {
  setActiveLocalAccount(null)
  window.localStorage.clear()
  window.sessionStorage.clear()
})

it("does not read multi-plan evidence for a linked V3 journal", () => {
  const packet = accountPlanPacketFixture(3)
  if (packet.state.version !== 3) throw Error("Expected V3 plan")
  const session = packet.state.activePlan.sessions[0]!
  const draft = createPlannedSessionLogDraft(packet.state, session, packet.state.generatedAt)
  if (draft === null) throw Error("Expected linked V3 journal")
  window.localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(packet.state))
  const readMultiEvidence = vi.fn(() => [])

  expect(readJournalOriginalPlan({ id: "linked-v3", date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toMatchObject({ kind: "matched", source: "ACTIVE", session })
  expect(readMultiEvidence).not.toHaveBeenCalled()
})

it("recognizes a valid empty multi-plan archive without evidence", () => {
  const content = { version: 3, entries: [] }
  const fingerprint = canonicalJsonFingerprint("trainoracle.multi-adjusted-original-archive.v3", content)
  window.localStorage.setItem(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY, JSON.stringify({
    ...content,
    contentFingerprint: fingerprint,
  }))

  expect(hasMultiAdjustedOriginalPlansV3()).toBe(false)
})

it.each([
  { reason: "malformed JSON", raw: "{" },
  { reason: "invalid fingerprint", raw: JSON.stringify({ version: 3, entries: [], contentFingerprint: "invalid" }) },
])("reports a linked plan as unavailable when the V6 archive has $reason", ({ raw }) => {
  const packet = accountPlanPacketFixture(6)
  if (packet.state.version !== 6 || packet.evidence === null || !("slots" in packet.evidence)
      || !("rpeBindings" in packet.evidence)) throw Error("Expected V6 plan")
  const evidence = packet.evidence as RetainedMultiAdjustedEvidenceV3
  const session = packet.state.selection.activePlan.sessions.find(candidate => candidate.prescription.kind === "ADJUSTED_METHOD_V3")
  if (session === undefined) throw Error("Expected V6 session")
  const draft = createPlannedSessionLogDraft(packet.state.selection, session, packet.state.selection.generatedAt)
  if (draft === null) throw Error("Expected linked V6 journal")
  window.localStorage.setItem(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY, raw)
  const readMultiEvidence = vi.fn(() => [evidence])

  expect(readJournalOriginalPlan({ id: "linked-v6-archived", date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toEqual({ kind: "unavailable" })
  expect(readMultiEvidence).toHaveBeenCalledOnce()
})

it.each([
  { version: "V4", key: ADJUSTED_PLAN_ARCHIVE_KEY },
  { version: "V5", key: ADJUSTED_PLAN_ARCHIVE_V3_KEY },
])("reports a linked plan as unavailable when the $version archive cannot be validated", ({ key }) => {
  const packet = accountPlanPacketFixture(3)
  if (packet.state.version !== 3) throw Error("Expected V3 plan")
  const session = packet.state.activePlan.sessions[0]!
  const draft = createPlannedSessionLogDraft(packet.state, session, packet.state.generatedAt)
  if (draft === null) throw Error("Expected linked journal")
  window.localStorage.setItem(key, "{")
  const readMultiEvidence = vi.fn(() => [])

  expect(readJournalOriginalPlan({ id: "linked-archived-plan", date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toEqual({ kind: "unavailable" })
  expect(readMultiEvidence).not.toHaveBeenCalled()
})

it("reads multi-plan evidence once for a linked V6 journal", () => {
  const packet = accountPlanPacketFixture(6)
  if (packet.state.version !== 6 || packet.evidence === null || !("slots" in packet.evidence)) throw Error("Expected V6 plan")
  const session = packet.state.selection.activePlan.sessions.find(candidate => candidate.prescription.kind === "ADJUSTED_METHOD_V3")
  if (session === undefined) throw Error("Expected V6 session")
  const draft = createPlannedSessionLogDraft(packet.state.selection, session, packet.state.selection.generatedAt)
  if (draft === null) throw Error("Expected linked V6 journal")
  window.localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(packet.state))
  const evidence = packet.evidence
  const readMultiEvidence = vi.fn(() => [evidence])

  expect(readJournalOriginalPlan({ id: "linked-v6", date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toMatchObject({ kind: "matched_multi_adjusted_v3", source: "ACTIVE", session })
  expect(readMultiEvidence).toHaveBeenCalledOnce()
})

it("does not read unrelated V6 evidence before finding a linked archived V3 plan", () => {
  const unrelated = accountPlanPacketFixture(6)
  if (unrelated.state.version !== 6 || unrelated.evidence === null || !("slots" in unrelated.evidence)
      || !("rpeBindings" in unrelated.evidence)) throw Error("Expected V6 plan")
  const evidence = unrelated.evidence as RetainedMultiAdjustedEvidenceV3
  const archive = prepareMultiAdjustedOriginalArchiveV3(null, unrelated.state, [evidence])
  if (archive.kind !== "prepared") throw Error("Expected V6 archive")

  const legacy = accountPlanPacketFixture(3)
  if (legacy.state.version !== 3) throw Error("Expected V3 plan")
  const session = legacy.state.activePlan.sessions[0]!
  const draft = createPlannedSessionLogDraft(legacy.state, session, legacy.state.generatedAt)
  if (draft === null) throw Error("Expected linked V3 journal")
  expect(savePlanBetaState(legacy.state)).toEqual({ ok: true })
  expect(archiveAndClearActivePlan(legacy.state)).toMatchObject({ ok: true })
  window.localStorage.setItem(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY, archive.raw)
  const readMultiEvidence = vi.fn(() => [evidence])

  expect(readJournalOriginalPlan({ id: "linked-archived-v3", date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toMatchObject({ kind: "matched", source: "ARCHIVED", session })
  expect(readMultiEvidence).not.toHaveBeenCalled()
})

it.each(["switch", "aba"] as const)("fails closed when the journal owner has an %s during V6 evidence reading", mode => {
  const packet = accountPlanPacketFixture(6)
  if (packet.state.version !== 6 || packet.evidence === null || !("slots" in packet.evidence)
      || !("rpeBindings" in packet.evidence)) throw Error("Expected V6 plan")
  const evidence = packet.evidence as RetainedMultiAdjustedEvidenceV3
  const session = packet.state.selection.activePlan.sessions.find(candidate => candidate.prescription.kind === "ADJUSTED_METHOD_V3")
  if (session === undefined) throw Error("Expected V6 session")
  const draft = createPlannedSessionLogDraft(packet.state.selection, session, packet.state.selection.generatedAt)
  if (draft === null) throw Error("Expected linked V6 journal")
  setActiveLocalAccount("scope-a")
  window.localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(packet.state))
  const readMultiEvidence = vi.fn(() => {
    if (readMultiEvidence.mock.calls.length === 1) {
      setActiveLocalAccount("scope-b")
      if (mode === "aba") setActiveLocalAccount("scope-a")
    }
    return [evidence]
  })

  expect(readJournalOriginalPlan({ id: `linked-v6-${mode}`, date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toEqual({ kind: "unavailable" })
  expect(readMultiEvidence).toHaveBeenCalledOnce()
})

it("returns unavailable and memoizes a thrown evidence read when a V6 archive also exists", () => {
  const packet = accountPlanPacketFixture(6)
  if (packet.state.version !== 6 || packet.evidence === null || !("slots" in packet.evidence)
      || !("rpeBindings" in packet.evidence)) throw Error("Expected V6 plan")
  const evidence = packet.evidence as RetainedMultiAdjustedEvidenceV3
  const session = packet.state.selection.activePlan.sessions.find(candidate => candidate.prescription.kind === "ADJUSTED_METHOD_V3")
  if (session === undefined) throw Error("Expected V6 session")
  const draft = createPlannedSessionLogDraft(packet.state.selection, session, packet.state.selection.generatedAt)
  if (draft === null) throw Error("Expected linked V6 journal")
  const archive = prepareMultiAdjustedOriginalArchiveV3(null, packet.state, [evidence])
  if (archive.kind !== "prepared") throw Error("Expected V6 archive")
  window.localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(packet.state))
  window.localStorage.setItem(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY, archive.raw)
  const readMultiEvidence = vi.fn((): never => { throw Error("evidence unavailable") })

  expect(readJournalOriginalPlan({ id: "linked-v6-error", date: draft.date, plannedSessionLink: draft.link }, [], [], readMultiEvidence))
    .toEqual({ kind: "unavailable" })
  expect(readMultiEvidence).toHaveBeenCalledOnce()
})
