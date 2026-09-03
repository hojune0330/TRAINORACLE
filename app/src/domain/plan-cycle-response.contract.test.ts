import { describe, expect, it } from "vitest"
import { FIELD_PROVENANCE } from "./field-provenance"
import type { JournalEntry } from "./journal-schema"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { derivePlanCycleResponse } from "./plan-cycle-response"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"

function linkedEntry(day: number, rpe: number): Extract<JournalEntry, { readonly kind: "post-session" }> {
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

function stateWithTwoSessions() {
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

describe("cycle evidence integrity", () => {
  it("distinguishes zero comparable records from one record", () => {
    const entry = linkedEntry(1, 0)
    const result = derivePlanCycleResponse([entry], stateWithTwoSessions())
    expect(result).toMatchObject({ signal: "NO_COMPARABLE_RESULTS", comparableRpeCount: 0, unknownCount: 1 })
    expect(result.headline).not.toContain("한 번")
  })

  it("does not count the same journal twice as repeated evidence", () => {
    const entry = linkedEntry(1, 9)
    const result = derivePlanCycleResponse([entry, entry], stateWithTwoSessions())
    expect(result).toMatchObject({ signal: "ONE_SIGNAL", comparableRpeCount: 1, duplicateCount: 1 })
    expect(result.recommendation).toBe("MAINTAIN")
  })

  it("excludes conflicting copies and distinct journals for the same occurrence", () => {
    const entry = linkedEntry(1, 3)
    for (const other of [{ ...entry, rpe: 9 }, { ...entry, id: "second-id" }]) {
      const result = derivePlanCycleResponse([entry, other], stateWithTwoSessions())
      expect(result).toMatchObject({ comparableRpeCount: 0, conflictCount: 1 })
      expect(result.rows[0]?.comparison).toBe("CONFLICTING_RESULT")
      expect(result.rows[0]?.actualRpe).toBeNull()
    }
  })

  it("does not inspect private text even while deduplicating", () => {
    const entry = linkedEntry(1, 3)
    Object.defineProperty(entry, "memo", { get: () => { throw new Error("private text read") } })
    const result = derivePlanCycleResponse([entry, entry], stateWithTwoSessions())
    expect(result.comparableRpeCount).toBe(1)
    expect(result.duplicateCount).toBe(1)
  })

  it("rejects old generation versions and changed start dates", () => {
    const entry = linkedEntry(1, 3)
    const original = stateWithTwoSessions()
    for (const state of [
      { ...original, generatedAt: "2026-08-01T00:00:00.000Z" },
      { ...original, intake: { ...original.intake, startDate: "2026-08-02" } },
    ]) {
      expect(derivePlanCycleResponse([entry], state)).toMatchObject({
        linkedResultCount: 0, comparableRpeCount: 0, rejectedLinkCount: 1,
      })
    }
  })

  it("rejects changed session content even if the old candidate identifier is retained", () => {
    const state = stateWithTwoSessions()
    const entry = linkedEntry(1, 3)
    const changed = {
      ...state,
      activePlan: {
        ...state.activePlan,
        sessions: state.activePlan.sessions.map(session => session.role === "EASY"
          ? { ...session, prescription: { ...session.prescription, rpe: { minimum: 3, maximum: 5 } } }
          : session),
      },
    }
    expect(derivePlanCycleResponse([entry], changed).rejectedLinkCount).toBe(1)
  })

  it("rejects date and self-inconsistent link tampering", () => {
    const entry = linkedEntry(1, 3)
    if (entry.kind !== "post-session" || entry.plannedSessionLink === undefined) throw new Error("link missing")
    for (const changed of [
      { ...entry, date: "2026-07-25" },
      { ...entry, plannedSessionLink: { ...entry.plannedSessionLink, plannedDate: "2026-07-25" } },
    ]) {
      expect(derivePlanCycleResponse([changed], stateWithTwoSessions()).rejectedLinkCount).toBe(1)
    }
  })

  it.each(["RESTED", "SKIPPED"] as const)("does not compare %s as performed training", (activityOutcome) => {
    const result = derivePlanCycleResponse([{ ...linkedEntry(1, 9), activityOutcome }], stateWithTwoSessions())
    expect(result.comparableRpeCount).toBe(0)
    expect(result.rows[0]).toMatchObject({ comparison: "NOT_PERFORMED", actualRpe: null })
  })

  it.each(["PARTIAL", "LIGHT_ACTIVITY"] as const)("retains %s without pretending the original prescription was followed", (activityOutcome) => {
    const result = derivePlanCycleResponse([{ ...linkedEntry(1, 9), activityOutcome }], stateWithTwoSessions())
    expect(result.comparableRpeCount).toBe(0)
    expect(result.rows[0]).toMatchObject({ comparison: "CHANGED_SESSION", actualRpe: 9 })
  })

  it("does not compare an explicitly modified session or mismatched slot", () => {
    const entry = linkedEntry(1, 9)
    for (const changed of [
      { ...entry, planExecutionRelation: "MODIFIED" as const },
      { ...entry, activitySlot: "PM" as const },
    ]) {
      expect(derivePlanCycleResponse([changed], stateWithTwoSessions()).rows[0]?.comparison).toBe("CHANGED_SESSION")
    }
  })

  it("counts below-range observations separately and never increases dose", () => {
    const result = derivePlanCycleResponse([linkedEntry(1, 1), linkedEntry(2, 1)], stateWithTwoSessions())
    expect(result).toMatchObject({ lowerThanRangeCount: 2, comparableRpeCount: 2, unknownCount: 0 })
    expect(result.recommendation).toBe("MAINTAIN_AND_REVIEW")
  })

  it("offers reduction review for two genuinely distinct above-range results without mutating the plan", () => {
    const state = stateWithTwoSessions()
    const before = JSON.stringify(state)
    const result = derivePlanCycleResponse([linkedEntry(1, 9), linkedEntry(2, 9)], state)
    expect(result).toMatchObject({ signal: "REPEATED_HIGHER_EFFORT", recommendation: "REDUCE_OR_REVIEW", higherThanRangeCount: 2 })
    expect(JSON.stringify(state)).toBe(before)
  })
})
