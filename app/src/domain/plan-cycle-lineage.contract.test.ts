import { describe, expect, it } from "vitest"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { prepareCatalogReplacement } from "./catalog-replacement"
import { prepareExecutionReplan } from "./execution-replan"
import { replanFixture } from "./execution-replan.test-fixture"
import { FIELD_PROVENANCE } from "./field-provenance"
import { derivePlanCycleResponse } from "./plan-cycle-response"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { collectSessionExplanationEvidence } from "./session-explanation-evidence"
import { buildOraclePersonalResult } from "./oracle-personal-result"

export function cycleLineageFixture() {
  const f = replanFixture()
  const inputs = { eventDistanceM: 5000, experience: f.state.intake.experienceBand,
    availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] }
  const replacement = ALL_WORKOUT_CATALOG.filter(row => row.family === "BASE").map(row =>
    prepareCatalogReplacement({ ...f, address: { day: 4, slot: "AM" }, catalogId: row.id,
      inputs, acceptStronger: false, acceptLonger: true })).find(result => result.kind === "ready")
  if (replacement?.kind !== "ready") throw Error("catalog fixture missing")
  const middle = replacement.proposal.after
  const replan = prepareExecutionReplan({ ...f, state: middle, archivedPlans: [f.state], now: "2026-09-29T04:00:00.000Z" })
  if (replan.kind !== "ready") throw Error("replan fixture missing")
  const current = replan.proposals.find(p => p.action === "REDUCE")!.after
  const entry = { ...f.entries[0]!, activityOutcome: "COMPLETED" as const,
    planExecutionRelation: "AS_PLANNED" as const, rpe: 3,
    fieldProvenance: { rpe: { provenance: FIELD_PROVENANCE.explicit } } }
  return { ...f, middle, current, entry, history: { kind: "loaded" as const, plans: [f.state, middle] } }
}

describe("same-cycle evidence across plan changes", () => {
  it.each(["ACTIVE", "ARCHIVED"] as const)("keeps a %s linked result performed in the other slot as changed, not missing", (source) => {
    const f = cycleLineageFixture(), session = f.current.activePlan.sessions.find(s => s.day === 1)!
    const link = source === "ACTIVE"
      ? createPlannedSessionLogDraft(f.current, session, "2026-09-29T05:00:00.000Z")!.link : f.entry.plannedSessionLink!
    const entry = { ...f.entry, plannedSessionLink: link, activitySlot: "PM" as const, planExecutionRelation: "MODIFIED" as const }
    const detail = collectSessionExplanationEvidence([entry], f.current, session, f.history)!
    expect(detail.rows).toMatchObject([{ comparison: "CHANGED_SESSION", source }])
    expect(detail.methodObservation).toMatchObject({ status: "LINKED", actual: { rpe: 3 },
      results: [{ relation: "MODIFIED", actualSlot: "PM" }], measuredAdherence: null })
    expect(derivePlanCycleResponse([entry], f.current, f.history)).toMatchObject({ linkedResultCount: 1, comparableRpeCount: 0 })
  })

  it("recovers an unchanged occurrence through catalog and replan originals without rewriting data", () => {
    const f = cycleLineageFixture(), before = JSON.stringify(f)
    const result = derivePlanCycleResponse([f.entry], f.current, f.history)
    expect(result).toMatchObject({ linkedResultCount: 1, comparableRpeCount: 1,
      archivedResultCount: 1, historyReadIncomplete: false, signal: "ONE_SIGNAL" })
    expect(result.rows[0]).toMatchObject({ source: "ARCHIVED", plannedSessionId: f.entry.plannedSessionLink!.plannedSessionId,
      actualRpe: 3, plannedRpe: { minimum: 3, maximum: 4 }, comparison: "WITHIN_RANGE" })
    expect(JSON.stringify(f)).toBe(before)
  })

  it("does not invent a chain from missing, tampered or unrelated originals", () => {
    const f = cycleLineageFixture()
    for (const plans of [[], [f.state], [f.middle],
      [{ ...f.state, generatedAt: "2026-08-01T00:00:00.000Z" }, f.middle],
      [f.state, { ...f.middle, catalogReplacement: { ...f.middle.catalogReplacement!, baseCandidateId: "forged" } }]]) {
      expect(derivePlanCycleResponse([f.entry], f.current, { kind: "loaded", plans })).toMatchObject({
        linkedResultCount: 0, comparableRpeCount: 0, rejectedLinkCount: 1,
      })
    }
  })

  it("counts exact archived duplicates once without reading private text", () => {
    const f = cycleLineageFixture()
    Object.defineProperty(f.entry, "memo", { get() { throw Error("private memo read") } })
    const result = derivePlanCycleResponse([f.entry, f.entry], f.current, f.history)
    expect(result).toMatchObject({ linkedResultCount: 1, duplicateCount: 1, comparableRpeCount: 1 })
    expect(result.recommendation).toBe("MAINTAIN")
  })

  it("does not count different candidate versions of one occurrence as repeated effort", () => {
    const f = cycleLineageFixture(), session = f.current.activePlan.sessions.find(s => s.day === 1)!
    const linked = createPlannedSessionLogDraft(f.current, session, "2026-09-29T05:00:00.000Z")!
    const second = { ...f.entry, id: "second-result", rpe: 9, plannedSessionLink: linked.link }
    const result = derivePlanCycleResponse([{ ...f.entry, rpe: 9 }, second], f.current, f.history)
    expect(result).toMatchObject({ linkedResultCount: 1, comparableRpeCount: 0, conflictCount: 1,
      signal: "NO_COMPARABLE_RESULTS", recommendation: "MAINTAIN" })
    expect(result.rows[0]).toMatchObject({ actualRpe: null, comparison: "CONFLICTING_RESULT" })
  })

  it("keeps archived modified results descriptive, not comparable", () => {
    const f = cycleLineageFixture()
    expect(derivePlanCycleResponse([{ ...f.entry, activityOutcome: "PARTIAL" }], f.current, f.history))
      .toMatchObject({ linkedResultCount: 1, comparableRpeCount: 0, rows: [{ comparison: "CHANGED_SESSION" }] })
  })

  it("distinguishes unreadable history from no journal while keeping direct evidence", () => {
    const f = cycleLineageFixture(), session = f.current.activePlan.sessions.find(s => s.day === 1)!
    const direct = { ...f.entry, plannedSessionLink: createPlannedSessionLogDraft(f.current, session, "2026-09-29T05:00:00.000Z")!.link }
    const result = derivePlanCycleResponse([direct], f.current, { kind: "unavailable" })
    expect(result).toMatchObject({ linkedResultCount: 1, comparableRpeCount: 1, historyReadIncomplete: true })
    expect(result.evidence.join(" ")).toContain("변경 전 계획을 불러오지 못해")
  })

  it("does not attribute a wrong date or changed target to this cycle", () => {
    const f = cycleLineageFixture()
    const changedSession = f.state.activePlan.sessions.find(s => s.day === 3)!
    const entry = { ...f.entry, date: "2026-09-30", plannedSessionLink:
      createPlannedSessionLogDraft(f.state, changedSession, "2026-09-28T00:00:00.000Z")!.link }
    expect(planBetaStateV3Schema.safeParse(f.current).success).toBe(true)
    for (const value of [entry, { ...f.entry, date: "2026-10-01" }]) {
      expect(derivePlanCycleResponse([value], f.current, f.history).rejectedLinkCount).toBe(1)
    }
  })

  it("connects the same original evidence to saved-session detail and personal Oracle", () => {
    const f = cycleLineageFixture(), session = f.current.activePlan.sessions.find(s => s.day === 1)!
    const detail = collectSessionExplanationEvidence([f.entry], f.current, session, f.history)
    expect(detail?.rows[0]).toMatchObject({ actualRpe: 3, source: "ARCHIVED" })
    expect(detail?.methodObservation).toMatchObject({ status: "LINKED", actual: { rpe: 3 } })
    expect(detail?.methodObservation?.occurrence.plannedSessionId).toBe(detail?.sessionId)
    expect(detail?.rows[0]?.currentPlannedSessionId).toBe(detail?.sessionId)
    const oracle = buildOraclePersonalResult({ topicId: "focus", entries: [f.entry], planState: f.current,
      planHistory: f.history, today: "2026-09-29" })
    expect(oracle.status).toBe("partial")
    expect(oracle.rows).toHaveLength(1)
    expect(oracle.source).toContain("1건")
    const unavailable = buildOraclePersonalResult({ topicId: "focus", entries: [f.entry], planState: f.current,
      planHistory: { kind: "unavailable" }, today: "2026-09-29" })
    expect(unavailable).toMatchObject({ status: "partial", fingerprint: null, actionLabel: "현재 계획 확인" })
    expect(unavailable.summary).toContain("아직 판단할 수 없어요")
  })
})
