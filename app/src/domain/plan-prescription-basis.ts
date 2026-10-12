import type { PlanSession } from "@impl/plan-generator/types"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"

type BasisCounts = { actual: number; goal: number; direct: number; unconfirmed: number }

function calculatedBasis(session: Exclude<PlanSession, { role: "REST" }>): Omit<BasisCounts, "unconfirmed"> & { unconfirmed: boolean } {
  if (session.prescription.kind === "PACE_TARGET") {
    return session.prescription.selectedAnchor.kind === "GOAL"
      ? { actual: 0, goal: 1, direct: 0, unconfirmed: false }
      : { actual: 1, goal: 0, direct: 0, unconfirmed: false }
  }

  const binding = session.prescription.catalogWorkout
  if (!binding) return { actual: 0, goal: 0, direct: 0, unconfirmed: false }

  const calculation = resolveCatalogBinding(binding)
  if (!calculation) return { actual: 0, goal: 0, direct: 0, unconfirmed: true }

  const steps = calculation.steps.filter(step => step.phase === "main" && step.kind === "WORK")
  return {
    actual: Number(steps.some(step => step.targetModel === "FIVE_K_REFERENCE"
      || step.targetModel === "THRESHOLD_REFERENCE" || step.targetModel === "ACTUAL_RACE_REFERENCE")),
    goal: Number(steps.some(step => step.targetModel === "GOAL_RACE_REFERENCE")),
    direct: Number(steps.some(step => step.targetModel === "EXPLICIT_SEGMENT_PACE"
      || step.targetModel === "EXPLICIT_SEGMENT_SECONDS")),
    unconfirmed: false,
  }
}

/** Describes validated work-segment values across the displayed plan, including EASY. */
export function planPrescriptionBasis(sessions: readonly PlanSession[], confirmationPending = false) {
  const workouts = sessions.filter((session): session is Exclude<PlanSession, { role: "REST" }> => session.role !== "REST")
  const counts = workouts.reduce<BasisCounts>((total, session) => {
    const item = calculatedBasis(session)
    return {
      actual: total.actual + item.actual,
      goal: total.goal + item.goal,
      direct: total.direct + item.direct,
      unconfirmed: total.unconfirmed + Number(item.unconfirmed),
    }
  }, { actual: 0, goal: 0, direct: 0, unconfirmed: 0 })

  const labels = [
    counts.actual > 0 && `내 기록으로 페이스 계산 · 훈련 ${counts.actual}회`,
    counts.goal > 0 && `목표기록으로 페이스 계산 · 훈련 ${counts.goal}회`,
    counts.direct > 0 && `직접 정한 페이스·구간 시간 · 훈련 ${counts.direct}회`,
    counts.unconfirmed > 0 && `계산 확인 필요 · 훈련 ${counts.unconfirmed}회`,
  ].filter((label): label is string => Boolean(label))

  const hasVerifiedBasis = counts.actual + counts.goal + counts.direct > 0
  const detail = hasVerifiedBasis
    ? "페이스·구간 시간은 표시된 구간에만 적용돼요. 다른 구간은 날짜별 시간·힘든 정도를 따르세요. 반복 횟수와 회복 시간은 페이스와 별도로 구성돼요."
    : counts.unconfirmed > 0
      ? "페이스 계산을 확인할 수 없어요. 날짜별 훈련 안내를 확인해 주세요."
      : "시간과 힘든 정도에 맞춰 훈련하세요. 날짜별 안내에서 반복 횟수와 회복 구성을 확인해 주세요."

  const importantNotices = [
    counts.goal > 0 && "목표기록은 페이스 계산에 사용됐어요. 현재 실력이나 실제 달성 기록을 뜻하지 않아요.",
    counts.unconfirmed > 0 && "일부 훈련의 계산 상태를 확인하지 못했어요. 페이스 기준을 다시 확인해 주세요.",
  ].filter((notice): notice is string => Boolean(notice))

  return {
    label: labels.length > 0 ? labels.join(" · ") : "시간·힘든 정도로 훈련",
    detail,
    importantNotice: importantNotices.length > 0 ? importantNotices.join(" ") : undefined,
    pendingNotice: confirmationPending
      ? "기준 확인이 아직 끝나지 않았어요. 확인을 마치기 전에는 계획을 시작할 수 없어요."
      : undefined,
  }
}
