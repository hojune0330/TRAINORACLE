import { describe, expect, it } from "vitest"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, calculatedWorkoutSequence, compareCatalogPerformance, verifyCalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { deriveSequenceV3Totals } from "@impl/prescription/sequence-v3"
import { bindCatalogSession, isValidCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { rpeForIntent, rangesFor } from "@impl/plan-generator/session-builder"
import type { PlanSession, PlannedEnergyIntent } from "@impl/plan-generator/types"

const input: WorkoutCalculationInputs = { eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
  confirmedRequirements: [], fiveK: { recordId: "current-5k", seconds: 1111.7, achievedAt: "2026-09-01", evaluatedAt: "2026-09-30" }, segmentPaces: [] }
describe("every catalog workout has a deterministic calculation and evidence connection", () => {
  it.each(ALL_WORKOUT_CATALOG.map(e => [e.id, e] as const))("%s expands and independently reconciles the sequence", (id, entry) => {
    const result = calculateCatalogWorkout(id, input)
    expect(result).not.toBeNull()
    expect(verifyCalculatedWorkout(result)).toBe(true)
    if (!entry.sequence) { expect(result!.steps).toHaveLength(0); return }
    const totals = deriveSequenceV3Totals(entry.sequence)
    expect(result!.totals.workOccurrences).toBe(totals.main.workSegments)
    expect(result!.totals.mainDistanceM).toBe(totals.main.workDistanceM)
    expect(result!.totals.recoveryOccurrences).toBe(totals.warmup.recoverySteps + totals.main.recoverySteps + totals.cooldown.recoverySteps)
    expect(new Set(result!.steps.map(s => s.key)).size).toBe(result!.steps.length)
    expect(entry.sourceRefs.every(s => typeof s === "string" && (s.startsWith("https://") || s.startsWith("specs/")))).toBe(true)
    const actual = result!.steps.slice(0, 2).map(s => ({ key: s.key, seconds: s.seconds?.minimum ?? 30 }))
    expect(compareCatalogPerformance(result!, actual)?.unrecordedSteps).toBe(result!.steps.length - actual.length)
    const tampered = structuredClone(result!)
    ;(tampered.totals as { workOccurrences: number }).workOccurrences++
    expect(verifyCalculatedWorkout(tampered)).toBe(false)
  })
  it("does not turn absent hill recovery or sprint timing into zero or race-derived targets", () => {
    for (const e of ALL_WORKOUT_CATALOG.filter(e => e.segments.some(s => s.terrain === "UPHILL") || e.family === "ATP-PC")) {
      const r = calculateCatalogWorkout(e.id, input)!
      expect(r.steps.filter(s => s.phase === "main" && (s.terrain === "UPHILL" || ["ATP-PC", "ATP_PC"].includes(s.intent))).every(s => s.referenceRecordId === null)).toBe(true)
      expect(r.steps.filter(s => s.kind === "RECOVERY" && s.seconds === null).every(s => s.instruction.includes("미지정"))).toBe(true)
    }
  })
  it("retains decimals and rejects arbitrary or stale personal inputs", () => {
    const r = calculateCatalogWorkout("X-LT-01", input)!
    expect(r.steps.some(s => s.referenceRecordId === "current-5k")).toBe(true)
    expect(calculateCatalogWorkout("X-LT-01", { ...input, fiveK: { ...input.fiveK!, achievedAt: "2020-01-01" } })!.steps.every(s => s.referenceRecordId === null)).toBe(true)
    expect(calculateCatalogWorkout("X-LT-01", { ...input, memo: "private" } as WorkoutCalculationInputs)).toBeNull()
    expect(calculateCatalogWorkout("X-LT-01", { ...input, segmentPaces: [{ segmentId: "made-up", secondsPerKm: 300 }] })).toBeNull()
    const segmentId = ALL_WORKOUT_CATALOG.find(e => e.id === "X-LT-01")!.segments[0]!.segmentId
    expect(calculateCatalogWorkout("X-LT-01", { ...input, segmentPaces: [{ segmentId, secondsPerKm: "300" as unknown as number }] })).toBeNull()
  })
  it("does not equate an altered distance with failure at the planned pace", () => {
    const p = calculateCatalogWorkout("X-LT-01", input)!
    const s = p.steps.find(s => s.kind === "WORK" && s.distanceM !== null)!
    expect(compareCatalogPerformance(p, [{ key: s.key, distanceM: s.distanceM! / 2, seconds: 200 }])!.rows[0]!.timeDifference).toBeNull()
    expect(compareCatalogPerformance(p, [{ key: s.key, seconds: 0 }, { key: s.key, seconds: 0 }])).toBeNull()
  })
  it.each(ALL_WORKOUT_CATALOG.map(e => [e.id, e] as const))("%s accepts its missing numeric inputs without changing the source dose", (id, entry) => {
    const context = { ...input, eventDistanceM: entry.eventDistances[0]!, experience: entry.experience[0] as WorkoutCalculationInputs["experience"], confirmedRequirements: [...entry.requirements] }
    const first = calculateCatalogWorkout(id, context)!
    const missing = first.steps.filter(s => s.seconds === null).filter((s, i, all) => all.findIndex(other => other.segmentId === s.segmentId) === i)
    // Synthetic inputs exercise plumbing, not a recommended pace or recovery policy.
    const result = calculateCatalogWorkout(id, { ...context,
      segmentSeconds: missing.filter(s => s.kind !== "RECOVERY").map(s => ({ segmentId: s.segmentId, seconds: 45 })),
      recoverySeconds: missing.filter(s => s.kind === "RECOVERY").map(s => ({ segmentId: s.segmentId, seconds: 180 })),
    })!
    expect(result.unavailable).toEqual([])
    expect(result.totals.seconds).not.toBeNull()
    expect(result.totals.workOccurrences).toBe(first.totals.workOccurrences)
    expect(result.totals.recoveryOccurrences).toBe(first.totals.recoveryOccurrences)
    expect(result.steps.every(s => s.seconds !== null)).toBe(true)
    expect(verifyCalculatedWorkout(result)).toBe(true)
    if (entry.sequence) expect(calculatedWorkoutSequence(result)).not.toBeNull()
  })
  it("rejects invalid calendar dates, zero work and private record identifiers", () => {
    expect(calculateCatalogWorkout("X-LT-01", { ...input, fiveK: { ...input.fiveK!, achievedAt: "2026-02-30" } })).toBeNull()
    expect(calculateCatalogWorkout("X-LT-01", { ...input, fiveK: { ...input.fiveK!, recordId: "private athlete note" } })).toBeNull()
    const plan = calculateCatalogWorkout("X-LT-01", input)!, step = plan.steps.find(s => s.kind === "WORK")!
    expect(compareCatalogPerformance(plan, [{ key: step.key, seconds: 0 }])).toBeNull()
    expect(compareCatalogPerformance(plan, [{ key: step.key, seconds: 240 }])!.rows[0]!.distanceStatus).toBe("missing")
  })
  it.each(ALL_WORKOUT_CATALOG.filter(e => e.family !== "OFF").map(e => [e.id, e] as const))("%s binds to a compatible plan slot, not just a calculation", (id, entry) => {
    const context = { ...input, eventDistanceM: entry.eventDistances[0]!, experience: entry.experience[0] as WorkoutCalculationInputs["experience"], confirmedRequirements: [...entry.requirements] }
    const first = calculateCatalogWorkout(id, context)!
    const missing = first.steps.filter(s => s.seconds === null).filter((s, i, all) => all.findIndex(other => other.segmentId === s.segmentId) === i)
    const inputs = { ...context,
      segmentSeconds: missing.filter(s => s.kind !== "RECOVERY").map(s => ({ segmentId: s.segmentId, seconds: s.distanceM ? s.distanceM * 0.3 : 45 })),
      recoverySeconds: missing.filter(s => s.kind === "RECOVERY").map(s => ({ segmentId: s.segmentId, seconds: 180 })),
    }
    const intents: Record<string, PlannedEnergyIntent> = { BASE: "BASE_INTENT", REC: "RECOVERY_INTENT", LT: "LT_INTENT", VO2: "VO2_INTENT", GLY: "GLY_INTENT", "ATP-PC": "ATP_PC_INTENT", MIX: "MIXED_INTENT" }
    const intent = intents[entry.family]!, easy = ["BASE", "REC"].includes(entry.family)
    const session = { day: 1, slot: "AM", role: easy ? "EASY" : "QUALITY", plannedEnergyIntent: intent,
      prescription: { kind: "RPE_TIME_RANGE", rpe: rpeForIntent(intent), durationMinutes: rangesFor(context.experience)[easy ? "easy" : "quality"] } } as PlanSession
    // Explicit time fixtures test every connection; these are not recommended athlete targets.
    const bound = bindCatalogSession(session, id, inputs, true)
    expect(bound).not.toBeNull()
    expect(isValidCatalogSession(bound!)).toBe(true)
    if (bound!.prescription.kind !== "RPE_TIME_RANGE") throw Error("Wrong prescription")
    expect(resolveCatalogBinding(JSON.parse(JSON.stringify(bound!.prescription.catalogWorkout)))?.catalogId).toBe(id)
    expect(bound).toMatchObject({ day: session.day, slot: session.slot, role: session.role, plannedEnergyIntent: intent })
  })
})
