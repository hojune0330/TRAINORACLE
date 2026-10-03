import { describe, expect, it } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { AthleteRecord } from "./athlete-records"
import { createSegmentRecordReference } from "./catalog-pace-reference"
import { planSessionSchema } from "./plan-session-schema"
import {
  ACTIVE_PLAN_EDIT_POLICY, activePlanEditDurationConsentRequired, isPaceOnlyCatalogReplacement,
  replayActivePlanEdit, type ActivePlanEditReceipt,
} from "./active-plan-edit-policy"

const today = "2026-10-02"
const events = [[10000, "10000"], [21097.5, "HALF"], [42195, "42195"]] as const
const bare: PlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "MIXED_INTENT",
  prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 },
    durationMinutes: { minimum: 20, maximum: 30 } } }

function required<T>(value: T | null | undefined): T {
  if (value == null) throw Error("Expected a valid same-event catalog fixture")
  return value
}
function prescription(session: PlanSession) {
  if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected time range")
  return session.prescription
}
const binding = (session: PlanSession) => required(prescription(session).catalogWorkout)
function record(distance: number, secondsPerKm: number, id: string): AthleteRecord {
  return { schemaVersion: 1, id, purpose: "RECENT_RESULT", eventDistanceM: distance,
    performanceSeconds: distance * secondsPerKm / 1000, achievedOn: "2026-10-01", seasonId: null,
    enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: `athlete-record:${id}`,
    savedAt: `${today}T00:00:00.000Z` }
}
function bind(source: PlanSession, catalogId: string, distance: number, pace: number, id: string,
  acceptLongerDuration = true): PlanSession {
  const entry = required(ALL_WORKOUT_CATALOG.find(row => row.id === catalogId))
  const session = required(bindCatalogSession(source, catalogId, {
    eventDistanceM: distance, experience: "EXPERIENCED", availableSeconds: null,
    confirmedRequirements: [], fiveK: null, segmentPaces: [],
    paceReferences: [createSegmentRecordReference(entry.segments[0]!.segmentId,
      record(distance, pace, id), today, "RACE_AVERAGE_V1")],
  }, acceptLongerDuration))
  expect(planSessionSchema.safeParse(session).success).toBe(true)
  expect(resolveCatalogBinding(binding(session))?.unavailable).toEqual([])
  return session
}
function receipt(source: PlanSession, replacement: PlanSession): ActivePlanEditReceipt {
  return { version: 1, policy: ACTIVE_PLAN_EDIT_POLICY, trigger: "EXPLICIT_PLAN_EDIT", action: "PACE_REFERENCE",
    source: { day: source.day, slot: source.slot }, target: null,
    baseStateFingerprint: `sha256:${"a".repeat(64)}`, baseCandidateId: "same-event-duration-fixture",
    baseSessions: [source], protectedSlots: [], startDate: today, projectionLengthDays: 9, today,
    timeZone: "Asia/Seoul", unstartedConfirmed: true, evidenceFingerprint: `sha256:${"b".repeat(64)}`,
    journalGuard: null, noFixedFutureCommitments: false, maximumMinutes: null, replacement: null,
    replacements: [replacement], acceptedRpeMaximum: null, acceptedLongerDuration: false,
    acceptedAt: `${today}T03:00:00.000Z` }
}

describe("same-event long RP duration budget", () => {
  for (const [distance, idPart] of events) {
    const catalogId = `RP-${idPart}-DISTANCE`
    it.each([["faster", 540], ["same budget", 600]] as const)(
      `${distance}: accepts %s replacement inside the explicitly accepted source budget`, (_label, pace) => {
        const source = bind(bare, catalogId, distance, 600, "original")
        const replacement = bind(source, catalogId, distance, pace, "updated")
        const snapshot = structuredClone(source)
        const before = binding(source), after = binding(replacement)
        expect(before.acceptedDurationSeconds).toBeGreaterThan(before.originalEnvelope.durationMinutes.maximum * 60)
        expect(after.acceptedDurationSeconds).toBeGreaterThan(before.originalEnvelope.durationMinutes.maximum * 60)
        expect(after.acceptedDurationSeconds).toBeLessThanOrEqual(before.acceptedDurationSeconds!)
        expect(activePlanEditDurationConsentRequired(source, replacement)).toBe(false)
        expect(isPaceOnlyCatalogReplacement(source, replacement)).toBe(true)
        expect(replayActivePlanEdit(receipt(source, replacement))).toEqual([replacement])
        const oldSteps = required(resolveCatalogBinding(before)).steps
        const newSteps = required(resolveCatalogBinding(after)).steps
        expect(newSteps.map(s => [s.key, s.phase, s.kind, s.set, s.occurrence, s.distanceM]))
          .toEqual(oldSteps.map(s => [s.key, s.phase, s.kind, s.set, s.occurrence, s.distanceM]))
        expect(newSteps.filter(s => s.phase !== "main" || s.kind !== "WORK"))
          .toEqual(oldSteps.filter(s => s.phase !== "main" || s.kind !== "WORK"))
        expect(source).toEqual(snapshot)
      })

    it(`${distance}: rejects slower replacement beyond the accepted budget, even with fresh binding consent`, () => {
      const source = bind(bare, catalogId, distance, 600, "original")
      const replacement = bind(source, catalogId, distance, 660, "slower")
      expect(binding(replacement).acceptedDurationSeconds).toBeGreaterThan(binding(source).acceptedDurationSeconds!)
      expect(activePlanEditDurationConsentRequired(source, replacement)).toBe(true)
      expect(isPaceOnlyCatalogReplacement(source, replacement)).toBe(false)
      expect(replayActivePlanEdit(receipt(source, replacement))).toBeNull()
      expect(replayActivePlanEdit({ ...receipt(source, replacement), acceptedLongerDuration: true })).toBeNull()
    })

    it(`${distance}: accepts faster timed RP without changing time-based termination`, () => {
      const id = `RP-${idPart}-TIMED`
      const source = bind(bare, id, distance, 600, "original")
      const replacement = bind(source, id, distance, 540, "faster")
      expect(binding(source).acceptedDurationSeconds).toBeGreaterThan(30 * 60)
      expect(prescription(replacement).durationMinutes).toEqual(prescription(source).durationMinutes)
      expect(isPaceOnlyCatalogReplacement(source, replacement)).toBe(true)
      expect(replayActivePlanEdit(receipt(source, replacement))).toEqual([replacement])
    })
  }

  it("does not recover an older larger budget after a faster update", () => {
    const original = bind(bare, "RP-10000-DISTANCE", 10000, 600, "original")
    const faster = bind(original, "RP-10000-DISTANCE", 10000, 540, "faster")
    const slower = bind(faster, "RP-10000-DISTANCE", 10000, 570, "slower")
    expect(binding(slower).acceptedDurationSeconds).toBeLessThan(binding(original).acceptedDurationSeconds!)
    expect(activePlanEditDurationConsentRequired(faster, slower)).toBe(true)
    expect(isPaceOnlyCatalogReplacement(faster, slower)).toBe(false)
  })

  it("allows faster RP to return within the original envelope without retaining longer-duration consent", () => {
    const envelope = structuredClone(bare)
    Object.assign(prescription(envelope).durationMinutes, { maximum: 50 })
    const source = bind(envelope, "RP-10000-DISTANCE", 10000, 600, "original")
    const faster = bind(source, "RP-10000-DISTANCE", 10000, 120, "faster")
    expect(binding(source).acceptedDurationSeconds).toBeGreaterThan(50 * 60)
    expect(binding(faster).acceptedDurationSeconds).toBeUndefined()
    expect(binding(faster).inputs.availableSeconds).toBe(50 * 60)
    expect(activePlanEditDurationConsentRequired(source, faster)).toBe(false)
    expect(isPaceOnlyCatalogReplacement(source, faster)).toBe(true)
    expect(replayActivePlanEdit(receipt(source, faster))).toEqual([faster])
  })

  it("keeps both the original envelope and a narrower current duration without accepted consent", () => {
    const envelope = structuredClone(bare)
    Object.assign(prescription(envelope).durationMinutes, { maximum: 50 })
    const source = bind(envelope, "RP-10000-DISTANCE", 10000, 120, "original", false)
    const slower = bind(source, "RP-10000-DISTANCE", 10000, 126, "slower", false)
    expect(binding(source).acceptedDurationSeconds).toBeUndefined()
    expect(prescription(slower).durationMinutes.maximum).toBeLessThanOrEqual(50)
    expect(activePlanEditDurationConsentRequired(source, slower)).toBe(true)
    expect(isPaceOnlyCatalogReplacement(source, slower)).toBe(false)
    const inflated = structuredClone(source)
    Object.assign(prescription(inflated).durationMinutes, { maximum: 100 })
    const overOriginal = bind(source, "RP-10000-DISTANCE", 10000, 600, "longer")
    expect(activePlanEditDurationConsentRequired(inflated, overOriginal)).toBe(true)
  })

  it("caps duration at accepted seconds even if the source display range is inflated", () => {
    const source = bind(bare, "RP-10000-DISTANCE", 10000, 600, "original")
    const slower = bind(source, "RP-10000-DISTANCE", 10000, 660, "slower")
    Object.assign(prescription(source).durationMinutes, { maximum: 100 })
    expect(activePlanEditDurationConsentRequired(source, slower)).toBe(true)
    expect(isPaceOnlyCatalogReplacement(source, slower)).toBe(false)
  })

  it("does not accept forged available seconds or unrelated fixed-input changes", () => {
    const source = bind(bare, "RP-10000-DISTANCE", 10000, 600, "original")
    const faster = bind(source, "RP-10000-DISTANCE", 10000, 540, "faster")
    const forged = structuredClone(faster)
    // The binder owns this derived budget; ignoring it in fixed-input comparison must not trust it.
    Object.assign(binding(forged).inputs, { availableSeconds: binding(source).inputs.availableSeconds })
    expect(isPaceOnlyCatalogReplacement(source, forged)).toBe(false)
    const timed = bind(bare, "RP-10000-TIMED", 10000, 600, "original")
    const changed = required(bindCatalogSession(timed, binding(timed).catalogId,
      { ...binding(timed).inputs, experience: "DEVELOPING" }, true))
    expect(planSessionSchema.safeParse(changed).success).toBe(true)
    expect(isPaceOnlyCatalogReplacement(timed, changed)).toBe(false)
  })
})
