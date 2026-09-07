import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"
import { saveSelectedAdjustedPlan } from "./adjusted-plan-store"
import { encodeStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { generateAdjustedNextFrameFromDraft } from "./plan-beta-flow"
import { loadAthleteRecords } from "./athlete-records"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { PlanMutationLockManager } from "./plan-mutation-lock"

export async function adjustedSuccessorFixture(setTime: (date: Date) => void) {
  const locks: PlanMutationLockManager = { request: async (_name, _options, callback) => callback({}) }
  const initial = adjustedPlanSelectionFixture()
  const saved = await saveSelectedAdjustedPlan({ request: initial.request, readReview: () => initial.review,
    isCurrentDraft: () => true, locks })
  if (saved.kind !== "saved") throw Error(saved.code)
  const progress = saved.state.selection.activePlan.sessions.filter(session => session.role !== "REST")
    .map(session => ({ sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" as const }))
  const old = encodeStoredAdjustedPlanState(saved.state.selection, progress, TODAY.toISOString(), initial.retained, TODAY)
  if (old.kind !== "encoded") throw Error("Expected old state")
  localStorage.setItem(activePlanBetaStorageKey(), old.raw)
  const now = new Date(`${old.state.selection.intake.startDate}T12:00:00`)
  setTime(now)
  const generated = generateAdjustedNextFrameFromDraft({ draft: old.state.selection.intake,
    currentCheck: "NO_KNOWN_RISK", expectedPredecessorFingerprint: old.state.contentFingerprint,
    prescriptionSelection: { selectedRecordId: loadAthleteRecords(now)[0]!.id } }, initial.retained)
  if (generated.kind !== "adjusted_next_frame_draft") throw Error(generated.code)
  const next = adjustedPlanSelectionFixture({}, generated.draft, now)
  const retained = [...initial.retained, ...next.retained]
  return { old, next, retained, now, input: { request: next.request,
    expectedPredecessorFingerprint: old.state.contentFingerprint,
    readReview: () => ({ ...next.review, retained }), isCurrentDraft: () => true, locks } }
}
