import type { CalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { paceClock, paceEventLabel } from "./pace-tools"
import type { WorkoutDisplaySession } from "./workout-notation"

/** Read only saved prescription inputs, never the athlete's current records. */
export function catalogPrescriptionBasis(workout: CalculatedWorkout): string {
  if (workout.unavailable.length) return "이 구성의 목표 기준 확인 필요"
  const references = (workout.inputs.paceReferences ?? []).filter(reference => workout.steps.some(step =>
    step.segmentId === reference.segmentId && step.referenceRecordId === reference.recordId
    && ["ACTUAL_RACE_REFERENCE", "GOAL_RACE_REFERENCE"].includes(step.targetModel)))
  const parts = references.map(reference => `${paceEventLabel(reference.eventDistanceM)} ${paceClock(reference.performanceSeconds)} · ${reference.kind === "GOAL" ? "목표 기준 (현재 실력 아님)" : "저장된 기록 기준"} · ${reference.model === "FIVE_K_THRESHOLD_V1" ? "역치 참고 범위, 측정값 아님" : "경기 평균 페이스"}`)
  if (workout.steps.some(step => ["FIVE_K_REFERENCE", "THRESHOLD_REFERENCE"].includes(step.targetModel)) && workout.inputs.fiveK) {
    parts.push(`5K ${paceClock(workout.inputs.fiveK.seconds)} 기록 기반 참고 · 계획에 저장된 값`)
  }
  if (workout.steps.some(step => ["EXPLICIT_SEGMENT_PACE", "EXPLICIT_SEGMENT_SECONDS"].includes(step.targetModel))) {
    parts.push("직접 지정한 구간 목표")
  }
  return [...new Set(parts)].join(" / ") || "체감 강도 기준 · 경기 기록 환산 아님"
}

export function sessionPrescriptionBasis(session: WorkoutDisplaySession): string | null {
  const p = session.prescription
  if (!p || p.kind === "REST") return null
  if (p.kind === "PACE_TARGET") {
    const anchor = p.selectedAnchor
    if (!anchor || !Number.isFinite(anchor.eventDistanceM) || anchor.eventDistanceM <= 0
      || !Number.isFinite(anchor.performanceSeconds) || anchor.performanceSeconds <= 0) return "저장된 기준 기록 확인 필요"
    return `${paceEventLabel(anchor.eventDistanceM)} ${paceClock(anchor.performanceSeconds)} · ${anchor.kind === "GOAL" ? "목표 기준 (현재 실력 아님)" : "계획에 저장된 기준 기록"} · 경기 평균 페이스`
  }
  if (p.kind === "RPE_TIME_RANGE") {
    const workout = p.catalogWorkout ? resolveCatalogBinding(p.catalogWorkout) : null
    if (p.catalogWorkout && !workout) return "저장된 상세 구성 확인 필요"
    return workout ? catalogPrescriptionBasis(workout) : "체감 강도 기준 · 경기 기록 환산 아님"
  }
  return "직접 조정한 구성 · 구간별 기준은 상세에서 확인"
}
