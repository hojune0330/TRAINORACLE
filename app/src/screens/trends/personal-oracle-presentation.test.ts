import { describe, expect, it } from "vitest"
import { isoShift } from "../../domain/dates"
import { projectStructuredJournalObservations, type StructuredJournalObservation } from "../../domain/journal-observation"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { personalOraclePresentation } from "./personal-oracle-presentation"

const today = "2026-10-25"
const base = projectStructuredJournalObservations([{
  id: "rpe-only", kind: "post-session", date: today, savedAt: `${today}T08:00:00Z`, syncState: "local",
  title: "", memo: "", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 6,
  fieldProvenance: { rpe: { provenance: "EXPLICIT" } },
}])[0]!

function present(observations: readonly StructuredJournalObservation[], planState = null as ReturnType<typeof stateFixture> | null) {
  return personalOraclePresentation({ observations, today, planState })
}

describe("personal Oracle displayed facts", () => {
  it("does not treat empty, date-only or plan-only information as analysis facts", () => {
    expect(present([]).hasAnalysisFacts).toBe(false)
    const dateOnly = { ...base, rpe: null }
    const result = personalOraclePresentation({ observations: [dateOnly], today, planState: null,
      savedSessions: [{ id: "date-only", date: today }] })
    expect(result.hasAnalysisFacts).toBe(false)
    expect(result.latestSaved).toEqual({ id: "date-only", date: today })
    expect(result.receipt).toBe("최근 8주 훈련 일지 1건을 남겼어요.")
    const planOnly = present([], stateFixture())
    expect(planOnly.hasPlan).toBe(true)
    expect(planOnly.hasAnalysisFacts).toBe(false)
    expect(planOnly.metricItems).toEqual([])
  })

  it("recognizes the exact eligible RPE fallback even without distance or energy metrics", () => {
    const result = present([base])
    expect(result.oracle.maturity).toBe("EMPTY")
    expect(result.available).toEqual([])
    expect(result.recent).toBe(base)
    expect(result.hasAnalysisFacts).toBe(true)
  })

  it("recognizes the same distance and energy values that the summary displays", () => {
    const rich = projectStructuredJournalObservations([{
      id: "rich", kind: "post-session", date: today, savedAt: `${today}T08:00:00Z`, syncState: "local",
      title: "", memo: "", system: "base", distanceKm: "8", durationMin: "", avgPace: "", rpe: 0,
      fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, system: { provenance: "EXPLICIT" } },
    }])
    const result = present(rich)
    expect(result.hasAnalysisFacts).toBe(true)
    expect(result.metricItems).toEqual([
      { id: "DISTANCE_FLOW", label: "달린 거리", value: "8 km", period: "최근 4주" },
      { id: "ENERGY_COVERAGE", label: "훈련 종류", value: "1가지 유형", period: "최근 8주" },
    ])
    expect(result.recent).toBeUndefined()
  })

  it.each(["MISSING", "DERIVED"] as const)("does not accept mere RPE presence with %s provenance", provenance => {
    const result = present([{ ...base, fieldProvenance: { ...base.fieldProvenance, rpe: provenance } }])
    expect(result.recent).toBeUndefined()
    expect(result.hasAnalysisFacts).toBe(false)
  })

  it("keeps malformed RPE values excluded by the structured observation projection", () => {
    for (const rpe of [11, Number.NaN]) {
      const observations = projectStructuredJournalObservations([{
        id: "invalid-rpe", kind: "post-session", date: today, savedAt: `${today}T08:00:00Z`, syncState: "local",
        title: "", memo: "", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe,
        fieldProvenance: { rpe: { provenance: "EXPLICIT" } },
      }])
      expect(present(observations).recent).toBeUndefined()
      expect(present(observations).hasAnalysisFacts).toBe(false)
    }
  })

  it("keeps the session source-kind and mixed-field eligibility boundaries", () => {
    expect(present([{ ...base, sourceRef: { ...base.sourceRef, sourceKind: "DAILY_CHECKIN_RECORD" } }]).hasAnalysisFacts).toBe(false)
    const mixed = projectStructuredJournalObservations([{
      id: "mixed", kind: "post-session", date: today, savedAt: `${today}T08:00:00Z`, syncState: "local",
      title: "", memo: "", system: "", distanceKm: "8", durationMin: "", avgPace: "", rpe: 4,
      fieldProvenance: { distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT_ACTIVITY_FILE_V1" },
        rpe: { provenance: "EXPLICIT" } },
    }])
    expect(present(mixed).recent?.rpe).toBe(4)
    expect(present(mixed).available).toEqual([])
  })

  it("preserves the inclusive 55-day boundary and excludes older and future RPE", () => {
    expect(present([{ ...base, loggedOn: isoShift(today, -55) }]).hasAnalysisFacts).toBe(true)
    for (const loggedOn of [isoShift(today, -56), isoShift(today, 1)]) {
      expect(present([{ ...base, loggedOn }]).hasAnalysisFacts).toBe(false)
    }
  })

  it.each([false, true])("excludes the entire conflicting duplicate identity in either input order (%s)", reverse => {
    const other = { ...base, rpe: 8 }
    const conflict = reverse ? [other, base, other] : [base, other, base]
    expect(present(conflict).recent).toBeUndefined()
    expect(present(conflict).hasAnalysisFacts).toBe(false)
    const dateConflict = [{ ...base, loggedOn: isoShift(today, -1) }, base]
    expect(present(reverse ? dateConflict.reverse() : dateConflict).recent).toBeUndefined()
    expect(present([base, { ...base }]).recent?.rpe).toBe(6)
  })

  it("keeps date precedence and observedAt descending order for the recent fallback", () => {
    const older = { ...base, loggedOn: isoShift(today, -1), sourceRef: { ...base.sourceRef, sourceId: "older", observedAt: `${today}T23:00:00Z` } }
    const earlier = { ...base, sourceRef: { ...base.sourceRef, sourceId: "earlier", observedAt: `${today}T07:00:00Z` }, rpe: 3 }
    for (const observations of [[base, older, earlier], [earlier, older, base]]) {
      expect(present(observations).recent).toBe(base)
    }
  })
})
