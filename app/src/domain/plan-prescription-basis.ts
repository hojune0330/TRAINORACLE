import type { PlanSession } from "@impl/plan-generator/types"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"

/** Describes only inputs actually used by the displayed prescriptions. */
export function planPrescriptionBasis(sessions: readonly PlanSession[], confirmationPending = false) {
  const main = sessions.filter(session => session.role === "QUALITY")
  const personalCount = main.filter(session => {
    if (session.prescription.kind === "PACE_TARGET") return true
    const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
    const calculation = binding && resolveCatalogBinding(binding)
    return calculation && calculation.steps.some(step => typeof step.referenceRecordId === "string" && step.targetModel !== "GOAL_RACE_REFERENCE")
  }).length
  const goalCount = main.filter(session => session.prescription.kind === "RPE_TIME_RANGE"
    && session.prescription.catalogWorkout?.inputs.paceReferences?.some(reference => reference.kind === "GOAL")).length
  if (goalCount > 0) return {
    label: `목표기록 기준 포함 · 주요 훈련 ${goalCount}회`,
    detail: "목표기록에서 계산한 구간이 있어요. 현재 실력이나 실제 달성 기록을 뜻하지 않아요. 각 구간의 기준을 확인해 주세요.",
  }
  if (personalCount > 0) return {
    label: confirmationPending ? "기록 확인 전 · 페이스 초안" : `기록 기준 페이스 · 주요 훈련 ${personalCount}회`,
    detail: confirmationPending
      ? "입력한 기록으로 계산한 초안이에요. 기준 기록을 확인해야 이 계획으로 시작할 수 있어요."
      : "개인 기록으로 계산한 구간에만 페이스를 적용했어요. 나머지 구간은 표시된 시간·체감 강도를 따르세요. 모든 훈련 수치가 기록에서 계산된 것은 아니에요.",
  }
  const specified = main.some(session => session.prescription.kind === "RPE_TIME_RANGE"
    && session.prescription.catalogWorkout && (session.prescription.catalogWorkout.inputs.segmentPaces.length > 0
      || (session.prescription.catalogWorkout.inputs.segmentSeconds?.length ?? 0) > 0))
  return specified ? {
    label: "선택한 구성 · 직접 정한 구간 수치",
    detail: "검토된 훈련 구성에 직접 확인한 구간 수치를 사용했어요. 개인 경기 기록에서 자동으로 계산한 페이스는 아니에요.",
  } : {
    label: "시간·체감 강도 기준",
    detail: "고른 종목·경험·목적에 맞는 구성입니다. 개인 경기 기록을 페이스 계산에 사용하지 않았어요. 거리형 훈련은 표시된 거리와 체감 강도를 따르세요.",
  }
}
