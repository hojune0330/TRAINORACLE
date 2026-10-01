import { beforeEach, describe, expect, it } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { derivePlanCycleResponse } from "./plan-cycle-response"
import type { PostSessionEntry } from "./journal-schema"

function fixture() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 10,
    trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "MORNING",
    selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  const main = result.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
  const generated = replaceCandidateCatalogWorkout(result.generated, main, "P-LT-B", {
    eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
    confirmedRequirements: [], fiveK: null, segmentPaces: [],
  }, true)
  if (!generated) throw Error("Reviewed LT fixture unavailable")
  const selected = selectPlanForActivation(generated.candidates[0].candidateId, generated, result.gate,
    { ...result.intake, startDate: "2026-09-01" }, result.athleteEvidence, new Date("2026-09-01T00:00:00Z"))
  if (selected.kind !== "selected") throw Error(selected.code)
  const state = planBetaStateV3Schema.parse(selected.state)
  const session = state.activePlan.sessions.find(s => s.role === "QUALITY")!
  if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw Error("No detailed MAIN")
  const calculation = resolveCatalogBinding(session.prescription.catalogWorkout)!
  const linked = createPlannedSessionLogDraft(state, session, state.generatedAt)!
  const work = calculation.steps.find(s => s.phase === "main" && s.kind === "WORK")!
  const entry: PostSessionEntry = { id: "segment-cycle-test", kind: "post-session", date: linked.date,
    savedAt: state.generatedAt, syncState: "local", system: "lt", title: "", memo: "",
    distanceKm: "", durationMin: "", avgPace: "", rpe: 10,
    fieldProvenance: { rpe: { provenance: "EXPLICIT" } }, plannedSessionLink: linked.link,
    exerciseLog: { version: 1, source: "SELF_REPORTED", components: [], plannedSegments: { version: 1, source: "SELF_REPORTED",
      plannedSessionId: linked.link.plannedSessionId, sessionContentFingerprint: linked.link.sessionContentFingerprint,
      calculationFingerprint: calculation.fingerprint, results: [{ key: work.key, seconds: work.seconds!.maximum }] } } }
  return { state, entry, calculation }
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

describe("cycle structured execution evidence", () => {
  it("keeps explicit partial segment facts without treating unrecorded segments as zero", () => {
    const { state, entry } = fixture()
    const result = derivePlanCycleResponse([entry], state)
    expect(result.comparableRpeCount).toBe(1)
    expect(result.rows[0]?.executionComparison).toMatchObject({ kind: "compared", changed: false })
    expect(result.rows[0]?.executionComparison?.unknowns.join()).toContain("미기록")
  })

  it("excludes known changed recovery from same-prescription RPE response", () => {
    const { state, entry, calculation } = fixture()
    const recovery = calculation.steps.find(s => s.kind === "RECOVERY")
    // Every accepted LT method with a recovery can be observed; no recovery is fabricated.
    if (!recovery?.seconds) throw Error("Fixture requires a reviewed recovery")
    const changed = { ...entry, exerciseLog: { ...entry.exerciseLog!, plannedSegments: {
      ...entry.exerciseLog!.plannedSegments!, results: [{ key: recovery.key, seconds: recovery.seconds.maximum + 1 }] } } }
    const result = derivePlanCycleResponse([changed], state)
    expect(result.comparableRpeCount).toBe(0)
    expect(result.rows[0]).toMatchObject({ comparison: "CHANGED_SESSION", actualRpe: 10,
      executionComparison: { kind: "compared", changed: true } })
  })

  it("excludes a shorter time-based MAIN from same-prescription RPE response", () => {
    const { state, entry } = fixture()
    entry.exerciseLog!.plannedSegments!.results[0]!.seconds = 1
    expect(derivePlanCycleResponse([entry], state)).toMatchObject({ comparableRpeCount: 0,
      rows: [expect.objectContaining({ comparison: "CHANGED_SESSION",
        executionComparison: expect.objectContaining({ changed: true }) })] })
  })

  it("does not use a forged calculation link as same-prescription effort", () => {
    const { state, entry } = fixture()
    entry.exerciseLog!.plannedSegments!.calculationFingerprint = `sha256:${"0".repeat(64)}`
    expect(derivePlanCycleResponse([entry], state).rows[0]).toMatchObject({ comparison: "CHANGED_SESSION",
      executionComparison: { kind: "unavailable" } })
  })

  it("does not collapse two copies with different actual segment values", () => {
    const { state, entry } = fixture()
    const other = structuredClone(entry)
    other.exerciseLog!.plannedSegments!.results[0]!.seconds! += 1
    expect(derivePlanCycleResponse([entry, other], state)).toMatchObject({ conflictCount: 1, comparableRpeCount: 0 })
  })

  it("preserves sub-display numeric changes in the successor evidence identity", () => {
    const { state, entry } = fixture()
    const before = derivePlanCycleResponse([entry], state).rows[0]!.executionFingerprint
    entry.exerciseLog!.plannedSegments!.results[0]!.seconds! += 0.001
    expect(derivePlanCycleResponse([entry], state).rows[0]!.executionFingerprint).not.toBe(before)
  })

  it("does not select one of two competing execution formats", () => {
    const { state, entry } = fixture()
    entry.exerciseLog!.plannedRepetitions = { version: 1, source: "SELF_REPORTED",
      plannedSessionId: entry.plannedSessionLink!.plannedSessionId,
      sessionContentFingerprint: entry.plannedSessionLink!.sessionContentFingerprint,
      results: [{ set: 1, repetition: 1, seconds: 30 }] }
    expect(derivePlanCycleResponse([entry], state).rows[0]?.comparison).toBe("CHANGED_SESSION")
  })

  it("never reads memo or exercise names while evaluating segments or deduplicating", () => {
    const { state, entry } = fixture()
    Object.defineProperty(entry, "memo", { get() { throw Error("private memo read") } })
    Object.defineProperty(entry.exerciseLog!, "components", { get() { throw Error("exercise names read") } })
    expect(derivePlanCycleResponse([entry, entry], state)).toMatchObject({ duplicateCount: 1, comparableRpeCount: 1 })
  })
})
