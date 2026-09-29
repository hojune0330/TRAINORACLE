import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { stateFixture } from "./plan-beta-store.test-fixture"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import type { PostSessionEntry } from "./journal-schema"

export function replanFixture() {
  const state = stateFixture() as PlanBetaStateV3
  state.intake.startDate = "2026-09-28"
  const easy = { role: "EASY" as const, plannedEnergyIntent: "BASE_INTENT" as const, slot: "AM" as const,
    prescription: { kind: "RPE_TIME_RANGE" as const, rpe: { minimum: 3, maximum: 4 }, durationMinutes: { minimum: 10, maximum: 20 } } }
  const quality = { role: "QUALITY" as const, plannedEnergyIntent: "LT_INTENT" as const, slot: "AM" as const,
    prescription: { kind: "RPE_TIME_RANGE" as const, rpe: { minimum: 7, maximum: 8 }, durationMinutes: { minimum: 20, maximum: 30 } } }
  const sessions = [{ ...easy, day: 1 }, { ...quality, day: 3 }, { ...easy, day: 4 }, { ...easy, day: 6 }, { ...quality, day: 7 }, { ...easy, day: 8 }]
  state.activePlan = { ...state.activePlan, sessions }
  const p = state.activePlan
  if (!("formationKind" in p.frame)) throw Error("fixture frame")
  p.candidateId = deriveCandidateId(p.candidateId, { kind: p.candidateKind, eventDistanceM: p.eventDistanceM,
    selectedDetailedTemplateRef: p.selectedDetailedTemplateRef, selectedEnergyIntent: p.selectedEnergyIntent,
    sourceMode: p.sourceMode, selectionAuthority: "SELF", frame: p.frame, sessions })
  state.progress = [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }]
  const entry: PostSessionEntry = { id: "replan-test", kind: "post-session", date: "2026-09-28", savedAt: "2026-09-28T09:00:00.000Z",
    syncState: "local", title: "SECRET TITLE", memo: "SECRET MEMO", system: "base", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
    activityOutcome: "PARTIAL", activitySlot: "AM", painCheckStatus: "NO_SIGNAL_REPORTED",
    plannedSessionLink: createPlannedSessionLogDraft(state, sessions[0]!, "2026-09-28T00:00:00.000Z")!.link }
  return { state, entries: [entry], entryId: entry.id, today: "2026-09-29", now: "2026-09-29T03:00:00.000Z",
    noFixedFutureCommitments: true, journalGuard: [{ documentId: "11111111-1111-5111-8111-111111111111", revision: 1 }] }
}
