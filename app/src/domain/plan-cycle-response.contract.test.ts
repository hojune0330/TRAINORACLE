import { describe, expect, it } from "vitest"
import { FIELD_PROVENANCE } from "./field-provenance"
import type { JournalEntry } from "./journal-schema"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { derivePlanCycleResponse } from "./plan-cycle-response"
import { stateFixture } from "./plan-beta-store.test-fixture"
import type { PlanBetaState } from "./plan-beta-store"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"

function linkedEntry(day: number, rpe: number): JournalEntry {
  const state = stateWithTwoSessions()
  const session = state.activePlan.sessions.find((candidate) => candidate.day === day)
  if (session === undefined) throw new Error("fixture session missing")
  const draft = createPlannedSessionLogDraft(state, session, "2026-08-29T00:00:00.000Z")
  if (draft === null) throw new Error("fixture link missing")
  return {
    id: `entry-${day}`,
    kind: "post-session",
    date: draft.date,
    savedAt: "2026-08-29T01:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe,
    memo: "private text must not be read",
    fieldProvenance: {
      rpe: { provenance: FIELD_PROVENANCE.explicit },
    },
    plannedSessionLink: draft.link,
  }
}

function stateWithTwoSessions(): PlanBetaState {
  const state = planBetaStateV3Schema.parse(stateFixture())
  const first = state.activePlan.sessions[0]
  if (first === undefined) throw new Error("fixture session missing")
  if (!("formationKind" in state.activePlan.frame)) throw new Error("canonical frame missing")
  const sessions = [first, { ...first, day: 2 }]
  const candidateId = deriveCandidateId(state.activePlan.candidateId, {
    kind: state.activePlan.candidateKind,
    eventDistanceM: state.activePlan.eventDistanceM,
    selectedDetailedTemplateRef: state.activePlan.selectedDetailedTemplateRef,
    selectedEnergyIntent: state.activePlan.selectedEnergyIntent,
    sourceMode: state.activePlan.sourceMode,
    selectionAuthority: state.activePlan.selectionActor === "SELF" ? "SELF" : "COACH_REQUIRED",
    frame: state.activePlan.frame,
    sessions,
  })
  return planBetaStateV3Schema.parse({
    ...state,
    activePlan: {
      ...state.activePlan,
      candidateId,
      sessions,
    },
  })
}

describe("plan cycle response evidence", () => {
  it("does not increase from missing linked journals", () => {
    const result = derivePlanCycleResponse([], stateFixture())
    expect(result.signal).toBe("NO_LINKED_RESULTS")
    expect(result.recommendation).toBe("MAINTAIN")
  })

  it("uses repeated explicit linked RPE only and recommends no automatic increase", () => {
    const state = stateWithTwoSessions()
    const days = state.activePlan.sessions.slice(0, 2).map((session) => session.day)
    const entries = days.map((day) => linkedEntry(day, 3))
    const result = derivePlanCycleResponse(entries, state)
    expect(result.comparableRpeCount).toBe(2)
    expect(result.recommendation).not.toMatch(/INCREASE/u)
    expect(["MAINTAIN_OR_VARY_METHOD", "MAINTAIN_AND_REVIEW"]).toContain(result.recommendation)
  })

  it("ignores private memo content", () => {
    const state = stateWithTwoSessions()
    const entry = linkedEntry(1, 10) as Extract<JournalEntry, { readonly kind: "post-session" }>
    const first = derivePlanCycleResponse([entry], state)
    const second = derivePlanCycleResponse([{ ...entry, memo: "completely different private text" }], state)
    expect(second).toEqual(first)
  })
})
