import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { activePlanEditEvidenceFingerprint } from "../active-plan-edit"
import { activePlanEditFingerprint, replayActivePlanEdit, type ActivePlanEditReceipt } from "../active-plan-edit-policy"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "../plan-beta-schema"
import { stateFixture } from "../plan-beta-store.test-fixture"
import {
  accountPlanEntry, emptyAccountPlanDocument, validateAccountPlanDocumentUpdate,
} from "./account-plan-document-schema"
import { splitAccountPlanCollection, validateAccountPlanCollectionUpdate } from "./account-plan-collection-schema"

const now = new Date("2026-10-01T03:00:00.000Z")
const today = "2026-10-01"
const startDate = "2026-10-05"

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { vi.useRealTimers() })

function editedTransition() {
  const before = planBetaStateV3Schema.parse({ ...stateFixture(), intake: { ...stateFixture().intake, startDate } })
  const source = before.activePlan.sessions[0]!
  const journalGuard: ActivePlanEditReceipt["journalGuard"] = []
  const evidenceFingerprint = activePlanEditEvidenceFingerprint([])
  const receipt: ActivePlanEditReceipt = {
    version: 1, policy: "manual-active-plan-edit-v1", trigger: "EXPLICIT_PLAN_EDIT", action: "DURATION",
    source: { day: source.day, slot: source.slot }, target: null,
    baseStateFingerprint: activePlanEditFingerprint({ state: before, evidenceFingerprint, journalGuard, today, timeZone: "Asia/Seoul" }),
    baseCandidateId: before.activePlan.candidateId, baseSessions: [...structuredClone(before.activePlan.sessions)],
    protectedSlots: [], startDate, projectionLengthDays: 9, today, timeZone: "Asia/Seoul", unstartedConfirmed: true,
    evidenceFingerprint, journalGuard, noFixedFutureCommitments: false, maximumMinutes: 25,
    replacement: null, acceptedRpeMaximum: null, acceptedLongerDuration: false, acceptedAt: now.toISOString(),
  }
  const sessions = replayActivePlanEdit(receipt)
  if (!sessions) throw Error("fixture edit did not replay")
  const frame = before.activePlan.frame
  if (!("formationKind" in frame) || !("slotCount" in frame)) throw Error("fixture requires canonical V3 frame")
  const activePlan = { ...before.activePlan, sessions,
    candidateId: deriveCandidateId(before.activePlan.candidateId, {
      kind: before.activePlan.candidateKind, eventDistanceM: before.activePlan.eventDistanceM,
      selectedDetailedTemplateRef: before.activePlan.selectedDetailedTemplateRef,
      selectedEnergyIntent: before.activePlan.selectedEnergyIntent, sourceMode: before.activePlan.sourceMode,
      selectionAuthority: "SELF", frame, sessions,
    }) }
  const after = planBetaStateV3Schema.parse({ ...before, activePlan, activePlanEdit: receipt })
  const previous = emptyAccountPlanDocument()
  const oldEntry = accountPlanEntry({ state: before, evidence: null }, now.toISOString())
  previous.data.plans.push(oldEntry); previous.data.currentPlanId = oldEntry.planId
  const next = structuredClone(previous)
  next.data.plans[0]!.archivedAt = now.toISOString()
  const newEntry = accountPlanEntry({ state: after, evidence: null }, now.toISOString())
  next.data.plans.push(newEntry); next.data.currentPlanId = newEntry.planId
  return { before, after, previous, next }
}

it("accepts exact replay through the journal-guarded collection transition and retains the predecessor", () => {
  const { previous, next } = editedTransition()
  expect(validateAccountPlanDocumentUpdate(previous, next)).toBe(false)
  expect(validateAccountPlanCollectionUpdate(splitAccountPlanCollection(previous), splitAccountPlanCollection(next))).toBe(true)
  expect(next.data.plans).toHaveLength(2)
  expect(next.data.plans[0]!.archivedAt).toBe(now.toISOString())
  expect(next.data.plans[0]!.snapshot).toEqual(previous.data.plans[0]!.snapshot)
  expect(next.data.plans[0]!.progress).toEqual(previous.data.plans[0]!.progress)
})

it("rejects a changed duration that is not the receipt replay", () => {
  const { next } = editedTransition()
  const altered = structuredClone(next)
  const selected = altered.data.plans.find(p => p.planId === altered.data.currentPlanId)!
  const state = selected.snapshot.state as PlanBetaStateV3
  state.activePlan.sessions[0]!.prescription.kind === "RPE_TIME_RANGE"
    && (state.activePlan.sessions[0]!.prescription.durationMinutes.maximum = 24)
  expect(() => planBetaStateV3Schema.parse(state)).toThrow(/Manual plan edits must replay/u)
})

it("rejects an active edit that also changes unrelated intake metadata", () => {
  const { previous, next } = editedTransition()
  const altered = structuredClone(next)
  const selected = altered.data.plans.find(p => p.planId === altered.data.currentPlanId)!
  const state = selected.snapshot.state as PlanBetaStateV3
  state.intake.availableDayCount = state.intake.availableDayCount === 4 ? 3 : 4
  const replacement = accountPlanEntry({ state: planBetaStateV3Schema.parse(state), evidence: null }, now.toISOString())
  const oldSelectedIndex = altered.data.plans.findIndex(p => p.planId === altered.data.currentPlanId)
  altered.data.plans.splice(oldSelectedIndex, 1, replacement)
  altered.data.currentPlanId = replacement.planId
  expect(validateAccountPlanCollectionUpdate(splitAccountPlanCollection(previous), splitAccountPlanCollection(altered))).toBe(false)
})
