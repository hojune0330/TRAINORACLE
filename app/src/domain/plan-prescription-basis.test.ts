import { beforeEach, describe, expect, it } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { createSegmentRecordReference } from "./catalog-pace-reference"
import { recordPaceSegments } from "./catalog-pace-reference"
import type { PlanSession } from "@impl/plan-generator/types"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import { planPrescriptionBasis } from "./plan-prescription-basis"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

function fixture() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: 5,
    requestedFrameLength: 9, trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  return result.generated
}

const baseInputs = { eventDistanceM: 5000, experience: "EXPERIENCED" as const,
  availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] }

function ltSegmentId() {
  const segment = recordPaceSegments("X-LT-01", baseInputs)[0]
  if (!segment) throw Error("Expected an eligible main LT segment")
  return segment.segmentId
}

function goalReference(segmentId: string) {
  return createSegmentRecordReference(segmentId, {
    schemaVersion: 1, id: "basis-goal-5k", purpose: "RACE_GOAL", eventDistanceM: 5000,
    performanceSeconds: 1111.7, achievedOn: null, seasonId: null, enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED", sourceRef: "athlete-record:basis-goal-5k",
    savedAt: "2026-09-30T00:00:00.000Z",
  }, "2026-09-30", "FIVE_K_THRESHOLD_V1")
}

function bindMain(inputs: WorkoutCalculationInputs) {
  const generated = fixture()
  const selected = generated.candidates[0].sessions.find(session => session.role === "QUALITY")!
  const changed = replaceCandidateCatalogWorkout(generated, { day: selected.day, slot: selected.slot }, "X-LT-01", inputs, true)
  if (!changed) throw Error("Expected a valid catalog workout binding")
  return changed.candidates[0].sessions
}

function paceTargetSession(kind: "GOAL" | "RECENT_RESULT"): PlanSession {
  // The basis reader intentionally consumes only these two discriminants from this prescription.
  return { role: "QUALITY", prescription: { kind: "PACE_TARGET", selectedAnchor: { kind } } } as unknown as PlanSession
}

describe("prescription basis uses calculated inputs", () => {
  it("says no numeric pace when the MAIN sessions use time and perceived effort only", () => {
    expect(planPrescriptionBasis(fixture().candidates[0].sessions).label)
      .toBe("시간·힘든 정도로 훈련")
  })

  it("keeps pending confirmation separate and visible without replacing the calculated source", () => {
    const sessions = bindMain({ ...baseInputs, fiveK: {
      recordId: "basis-5k", seconds: 1111.7, achievedAt: "2026-09-01", evaluatedAt: "2026-09-30",
    } })
    const basis = planPrescriptionBasis(sessions, true)
    expect(basis.label).toBe("내 기록으로 페이스 계산 · 훈련 1회")
    expect(basis.pendingNotice).toContain("확인을 마치기 전에는 계획을 시작할 수 없어요")
    expect(basis.detail).toContain("표시된 구간에만 적용")
    expect(basis.detail).toContain("반복 횟수와 회복 시간은 페이스와 별도로")
  })

  it("distinguishes an applied goal-record segment from actual-record pace", () => {
    const sessions = bindMain({ ...baseInputs, paceReferences: [goalReference(ltSegmentId())] })
    const label = planPrescriptionBasis(sessions).label
    expect(label).toBe("목표기록으로 페이스 계산 · 훈련 1회")
    expect(label).not.toContain("내 기록")
    const basis = planPrescriptionBasis(sessions)
    expect(basis.importantNotice).toContain("현재 실력이나 실제 달성 기록을 뜻하지 않아요")
    expect(basis.detail).not.toContain("현재 실력")
  })

  it("distinguishes explicitly entered segment values from record-derived pace", () => {
    const sessions = bindMain({ ...baseInputs, segmentPaces: [{ segmentId: ltSegmentId(), secondsPerKm: 300 }] })
    expect(planPrescriptionBasis(sessions).label).toBe("직접 정한 페이스·구간 시간 · 훈련 1회")
  })

  it("does not count a goal reference when its calculated binding cannot be confirmed", () => {
    const sessions = bindMain({ ...baseInputs, paceReferences: [goalReference(ltSegmentId())] })
    const selected = sessions.find(session => session.role === "QUALITY")!
    const staleSessions = sessions.map(session => {
      if (session.role !== "QUALITY" || session.day !== selected.day || session.slot !== selected.slot || session.prescription.kind !== "RPE_TIME_RANGE"
        || !session.prescription.catalogWorkout) return session
      return { ...session, prescription: { ...session.prescription, catalogWorkout: {
        ...session.prescription.catalogWorkout, calculationFingerprint: "stale-calculation",
      } } }
    })
    const label = planPrescriptionBasis(staleSessions).label
    expect(label).toBe("계산 확인 필요 · 훈련 1회")
    expect(label).not.toContain("목표기록")
    expect(planPrescriptionBasis(staleSessions).importantNotice).toContain("계산 상태를 확인하지 못했어요")
  })

  it("classifies goal and actual anchors distinctly for approved fixed prescriptions", () => {
    expect(planPrescriptionBasis([paceTargetSession("GOAL")]).label)
      .toBe("목표기록으로 페이스 계산 · 훈련 1회")
    expect(planPrescriptionBasis([paceTargetSession("RECENT_RESULT")]).label)
      .toBe("내 기록으로 페이스 계산 · 훈련 1회")
  })

  it("does not claim a calculated pace for ordinary EASY sessions", () => {
    expect(planPrescriptionBasis(fixture().candidates[0].sessions.filter(session => session.role !== "QUALITY")).label)
      .toBe("시간·힘든 정도로 훈련")
  })

  it("includes an explicitly paced EASY workout in the whole-plan pace source", () => {
    const easy: PlanSession = { day: 1, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT",
      prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 3, maximum: 4 }, durationMinutes: { minimum: 35, maximum: 60 } } }
    const bound = bindCatalogSession(easy, "X-BASE-02", { ...baseInputs,
      segmentPaces: [{ segmentId: "X-BASE-02-1", secondsPerKm: 300 }] })
    if (!bound) throw Error("Expected valid synthetic directly paced EASY")
    expect(planPrescriptionBasis([bound]).label).toBe("직접 정한 페이스·구간 시간 · 훈련 1회")
  })
})
