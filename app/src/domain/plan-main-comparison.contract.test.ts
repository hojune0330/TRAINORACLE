import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PaceTargetPlanPrescription, PlanCandidate, PlanSession } from "@impl/plan-generator/types"
import { comparePlanMainWork } from "./plan-main-comparison"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { RUNTIME_CASES, TODAY, draftFor, saveCurrentRecord, type MatrixCase } from "./prescription-quality-matrix.test-fixtures"
import { describeMainMethodDifferences, deriveSequenceTotals, deriveSequenceRecoveryDistanceTotals, type PrescriptionSequence } from "@impl/prescription/sequence"
import { sessionPrescriptionSequence } from "./session-prescription-sequence"
import { planSessionSchema } from "./plan-session-schema"
import { resolveDetailedPlanTemplateOptions } from "../screens/plan-beta/plan-template-options"

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.useRealTimers() })

function pair(fixture: MatrixCase = RUNTIME_CASES[0]): readonly [PlanCandidate, PlanCandidate] {
  const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
  const result = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
  if (result.kind !== "generated") throw new Error("Expected real generated candidates")
  return result.generated.candidates
}

function changePace(candidate: PlanCandidate, change: (p: PaceTargetPlanPrescription) => PaceTargetPlanPrescription): PlanCandidate {
  return { ...candidate, sessions: candidate.sessions.map((session) => session.prescription.kind === "PACE_TARGET"
    ? { ...session, prescription: withoutStoredSequence(change(session.prescription)) } as PlanSession : session) }
}

function withoutStoredSequence(prescription: PaceTargetPlanPrescription): PaceTargetPlanPrescription {
  // These are non-activatable comparison fixtures, not edits to bound saved plans.
  const { sequence: _sequence, ...legacy } = prescription
  return legacy
}

function detailedRow(a: PlanCandidate, b: PlanCandidate) {
  const result = comparePlanMainWork(a, b)
  const row = result.rows.find((row) => row.a?.kind === "PACE_TARGET")
  if (row === undefined) throw new Error("Expected detailed comparison")
  return { result, row }
}

describe("actual MAIN comparison, not candidate-label comparison", () => {
  it("compares the source example against the real 5000m template but rejects it as a stored prescription", () => {
    const fixture = RUNTIME_CASES.find(item => item.eventDistanceM === 5000)!
    const [a] = pair(fixture)
    const actual = a.sessions.find(session => session.prescription.kind === "PACE_TARGET")!
    const current = sessionPrescriptionSequence(actual)!
    const none = { mode: "NOT_APPLICABLE", seconds: null } as const
    const rollOn = { mode: "ACTIVE_ROLL_ON", seconds: null, distanceM: 100 } as const
    const source: PrescriptionSequence = {
      kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "SOURCE-REVIEW-ONLY", label: null,
      warmup: [], cooldown: [], terminalRecovery: rollOn, main: [{
        kind: "segment", id: "source-main", label: null, repeatCount: 12,
        work: { kind: "distance", distanceM: 400, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null },
        recoveryBetweenRepeats: rollOn, recoveryAfter: none,
      }],
    }
    expect(describeMainMethodDifferences(current, source)).toEqual(["WORK_UNIT", "RECOVERY", "TERMINAL_RECOVERY"])
    expect(deriveSequenceTotals(current)).toMatchObject({ totalRepetitions: 5, qualityDistanceM: 5000, plannedRecoverySeconds: 600 })
    expect(deriveSequenceTotals(source)).toMatchObject({ qualityDistanceM: 4800, repetitionRecoveryOccurrences: 11,
      terminalRecoveryOccurrences: 1, plannedRecoverySeconds: null })
    expect(deriveSequenceRecoveryDistanceTotals(source).plannedRecoveryDistanceM).toBe(1200)
    expect(planSessionSchema.safeParse(actual).success).toBe(true)
    const forged = planSessionSchema.safeParse({ ...actual, prescription: { ...actual.prescription, sequence: source } })
    expect(forged.success).toBe(false)
    if (forged.success) throw new Error("Source-only sequence entered the athlete plan")
    expect(forged.error.issues.some(issue => issue.path.join(".") === "prescription.sequence")).toBe(true)
    const options = resolveDetailedPlanTemplateOptions({ eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" }, TODAY.toISOString())
    expect(options.map(option => option.ref.templateId)).toEqual(["V2-SEED-05"])
  })

  it.each(RUNTIME_CASES)("compares every real $caseId slot without inventing a second method", (fixture) => {
    const [a, b] = pair(fixture)
    const before = JSON.stringify([a, b])
    const result = comparePlanMainWork(a, b)
    expect(result.sameMainValues).toBe(true)
    expect(result.sameMainPrescription).toBe(!result.hasUnspecified)
    expect(result.easyDurationOnly).toBe(true)
    expect(result.rows).toHaveLength(a.sessions.filter((session) => session.role === "QUALITY").length)
    const paceSession = a.sessions.find((session) => session.prescription.kind === "PACE_TARGET")!
    if (paceSession.prescription.kind !== "PACE_TARGET") throw new Error("Expected detailed prescription")
    const p = paceSession.prescription
    const row = result.rows.find((row) => row.a?.kind === "PACE_TARGET")!
    expect(row.methodRelation).toBe("SAME")
    expect(row.methodDifferences).toEqual([])
    expect(row.a?.work).toContain(`${p.repetitionDistanceM}m`)
    expect(row.a?.work).toContain(`총 ${p.totals.totalRepetitions}회`)
    expect(row.a?.recovery).toContain(`총 ${p.totals.repetitionRecoveryOccurrences}번`)
    expect(row.a?.intensity).not.toContain("RPE")
    expect(row.a?.time).toContain("미산정")
    expect(JSON.stringify(result)).not.toContain(p.selectedAnchor.sourceRef)
    expect(JSON.stringify([a, b])).toBe(before)
  })

  it.each([
    ["repeat count", (p: PaceTargetPlanPrescription) => ({ ...p, repetitionsPerSet: p.repetitionsPerSet + 1 })],
    ["set count", (p: PaceTargetPlanPrescription) => ({ ...p, setCount: p.setCount + 1 })],
    ["athlete pace", (p: PaceTargetPlanPrescription) => ({ ...p, targetRepSeconds: p.targetRepSeconds + 0.25 })],
  ] as const)("%s changes dose, not MAIN method", (_name, change) => {
    const [a, b] = pair()
    const { result, row } = detailedRow(a, changePace(b, change))
    expect(row.samePrescribedValues).toBe(false)
    expect(row.methodRelation).toBe("SAME")
    expect(row.methodDifferences).toEqual([])
    expect(result.easyDurationOnly).toBe(false)
  })

  it.each([
    ["repeat unit", (p: PaceTargetPlanPrescription) => ({ ...p, repetitionDistanceM: 300 })],
    ["recovery seconds", (p: PaceTargetPlanPrescription) => ({ ...p, repetitionRecoverySeconds: 90 })],
    ["recovery mode", (p: PaceTargetPlanPrescription) => ({ ...p, repetitionRecoveryMode: "JOG" as const })],
    ["target event", (p: PaceTargetPlanPrescription) => ({ ...p, targetEventDistanceM: 1500 })],
  ] as const)("%s is a structural difference requiring review, never an accepted pair", (_name, change) => {
    const [a, b] = pair()
    const { result, row } = detailedRow(a, changePace(b, change))
    expect(row.samePrescribedValues).toBe(false)
    expect(row.methodRelation).toBe("DIFFERENT_REQUIRES_REVIEW")
    expect(row.methodDifferences).toEqual([_name === "repeat unit" ? "WORK_UNIT" : _name === "target event" ? "TARGET" : "RECOVERY"])
    expect(result.sameMainPrescription).toBe(false)
    expect(result.easyDurationOnly).toBe(false)
  })

  it("names, anchor IDs and template labels do not create a different method", () => {
    const [a, b] = pair()
    const changed = changePace({ ...b, candidateId: "renamed", kind: "BALANCED" }, (p) => ({
      ...p, templateId: "LABEL_ONLY", notation: "NAME_ONLY",
      selectedAnchor: { ...p.selectedAnchor, sourceRef: "athlete-record:OTHER_PRIVATE_ID" },
    }))
    const { row } = detailedRow(a, changed)
    expect(row.samePrescribedValues).toBe(true)
    expect(row.methodRelation).toBe("SAME")
    expect(JSON.stringify(row)).not.toMatch(/OTHER_PRIVATE_ID|LABEL_ONLY|NAME_ONLY/u)
  })

  it("warmup changes prevent the easy-time-only claim but are not a new MAIN", () => {
    const [a, b] = pair()
    const { result, row } = detailedRow(a, changePace(b, (p) => ({ ...p, operationalComponents: {
      ...p.operationalComponents, warmup: { ...p.operationalComponents.warmup, easyDurationMinutes: 16 },
    } } as unknown as PaceTargetPlanPrescription)))
    expect(row.samePrescribedValues).toBe(true)
    expect(row.methodRelation).toBe("SAME")
    expect(result.easyDurationOnly).toBe(false)
  })

  it("derived repetition and recovery totals do not trust stale cached totals", () => {
    const [a, b] = pair()
    const changed = changePace(b, (p) => ({ ...p, totals: { ...p.totals, totalRepetitions: 99, repetitionRecoveryOccurrences: 77 } }))
    const { row } = detailedRow(a, changed)
    expect(row.b?.work).toBe(row.a?.work)
    expect(row.b?.recovery).toBe(row.a?.recovery)
    expect(row.b?.work).not.toContain("99")
    expect(row.b?.recovery).not.toContain("77")
  })

  it.each(["event", "intent", "frame", "slot", "missing", "duplicate", "session-intent"] as const)("%s mismatch blocks a shared-work claim", (mutation) => {
    const [a, b] = pair()
    const main = b.sessions.find((session) => session.prescription.kind === "PACE_TARGET")!
    const changed: PlanCandidate = mutation === "event" ? { ...b, eventDistanceM: 1500 }
      : mutation === "intent" ? { ...b, selectedEnergyIntent: "VO2_INTENT" }
        : mutation === "frame" ? { ...b, frame: { ...b.frame, projectionLengthDays: 10 } }
          : { ...b, sessions: mutation === "missing" ? b.sessions.filter((session) => session !== main)
            : mutation === "duplicate" ? [...b.sessions, main]
              : b.sessions.map((session) => session !== main ? session : mutation === "slot"
                ? { ...session, slot: session.slot === "AM" ? "PM" : "AM" }
                : { ...session, plannedEnergyIntent: "VO2_INTENT" } as PlanSession) }
    const result = comparePlanMainWork(a, changed)
    expect(result.sameMainPrescription).toBe(false)
    expect(result.easyDurationOnly).toBe(false)
    expect(result.rows.some((row) => row.methodRelation === "CONTEXT_MISMATCH")).toBe(true)
    expect(result.rows.filter(row => row.methodRelation === "CONTEXT_MISMATCH").every(row => row.methodDifferences.length === 0)).toBe(true)
  })

  it("RPE envelopes can match as values without being two explicit methods", () => {
    const [a, b] = pair()
    const withoutPace = (candidate: PlanCandidate): PlanCandidate => ({ ...candidate, sessions: candidate.sessions.map((session) => session.role !== "QUALITY" ? session : {
      ...session, prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 30, maximum: 40 } },
    }) })
    const result = comparePlanMainWork(withoutPace(a), withoutPace(b))
    expect(result.sameMainValues).toBe(true)
    expect(result.sameMainPrescription).toBe(false)
    expect(result.hasDetailed).toBe(false)
    for (const row of result.rows) {
      expect(row.methodRelation).toBe("UNSPECIFIED")
      expect(row.a?.work).toContain("미지정")
      expect(row.a?.recovery).toContain("미지정")
      expect(row.a?.time).toContain("준비·회복·정리 포함")
    }
  })

  it("an unreadable numeric structure never becomes an identical prescription", () => {
    const [a, b] = pair()
    const { result, row } = detailedRow(a, changePace(b, (p) => ({ ...p, setCount: 0 })))
    expect(row.b).toBeNull()
    expect(row.samePrescribedValues).toBe(false)
    expect(result.easyDurationOnly).toBe(false)
  })

  it("does not access notes or copy record evidence into the comparison", () => {
    const [originalA, originalB] = pair()
    const [a, b] = [{ ...originalA }, { ...originalB }]
    for (const candidate of [a, b]) Object.defineProperty(candidate, "memo", { get: () => { throw new Error("memo accessed") } })
    const result = comparePlanMainWork(a, b)
    expect(JSON.stringify(result)).not.toMatch(/sourceRef|anchorId|performanceSeconds|achievedAt|memo/u)
  })
})
