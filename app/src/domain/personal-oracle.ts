import { cumulativeDistance } from "./cumulative-distance"
import { isoShift } from "./dates"
import {
  buildEnergySystemLedger,
  energyLedgerWindow,
  summarizeCurrentPlanEnergy,
} from "./energy-system-ledger"
import { ENERGY_SYSTEM_META } from "./energy-system-taxonomy"
import type { StructuredJournalObservation } from "./journal-observation"
import type { PlanBetaState } from "./plan-beta-schema"

export const PERSONAL_ORACLE_VERSION = "PERSONAL_ORACLE_EXPLANATION_V1" as const

export type PersonalOracleMaturity = "EMPTY" | "STARTING" | "DESCRIPTIVE"

export type PersonalOracleInsight = {
  readonly id: "DISTANCE_FLOW" | "ENERGY_COVERAGE" | "PLAN_FOLLOW_THROUGH"
  readonly title: string
  readonly headline: string
  readonly detail: string
  readonly evidence: string
}

export type PersonalOracleExplanation = {
  readonly version: typeof PERSONAL_ORACLE_VERSION
  readonly maturity: PersonalOracleMaturity
  readonly summary: string
  readonly insights: readonly PersonalOracleInsight[]
  readonly knownFacts: readonly string[]
  readonly unknowns: readonly string[]
  readonly structuredSourceCount: number
}

type PersonalOracleInput = {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  readonly planState: PlanBetaState | null
}

function recentAcceptedSessions(
  observations: readonly StructuredJournalObservation[],
  startDate: string,
  endDate: string,
): readonly StructuredJournalObservation[] {
  return observations.filter((observation) => (
    observation.sourceRef.sourceKind === "SESSION_RESULT_RECORD"
    && observation.sourceRef.trustState === "ACCEPTED"
    && observation.loggedOn >= startDate
    && observation.loggedOn <= endDate
  ))
}

function distanceInsight(
  observations: readonly StructuredJournalObservation[],
  today: string,
): PersonalOracleInsight {
  const currentStart = isoShift(today, -27)
  const previousStart = isoShift(today, -55)
  const previousEnd = isoShift(today, -28)
  const current = cumulativeDistance(observations, {
    kind: "RECENT_MONTH",
    startDate: currentStart,
    endDate: today,
    precision: "LOCAL_DATE",
  })
  const previous = cumulativeDistance(observations, {
    kind: "RECENT_MONTH",
    startDate: previousStart,
    endDate: previousEnd,
    precision: "LOCAL_DATE",
  })

  if (current.totalKm === null) {
    return {
      id: "DISTANCE_FLOW",
      title: "최근 달린 거리",
      headline: "직접 적은 거리 기록이 아직 없어요",
      detail: "거리를 적으면 최근 4주와 그 전 4주를 같은 기준으로 나란히 보여드려요.",
      evidence: `최근 4주 반영 0건 · 제외 ${current.excludedSourceCount}건`,
    }
  }

  const comparison = previous.totalKm === null
    ? "그 전 4주는 비교할 기록이 없어요."
    : `그 전 4주 ${previous.totalKm} km와 함께 확인할 수 있어요.`
  return {
    id: "DISTANCE_FLOW",
    title: "최근 달린 거리",
    headline: `최근 4주 ${current.totalKm} km`,
    detail: `${comparison} 거리가 늘거나 줄었다는 사실만 보여주며, 다음 훈련량을 자동으로 바꾸지는 않아요.`,
    evidence: `최근 4주 반영 ${current.includedSourceCount}건 · 제외 ${current.excludedSourceCount}건`,
  }
}

function energyInsight(
  observations: readonly StructuredJournalObservation[],
  today: string,
): PersonalOracleInsight {
  const ledger = buildEnergySystemLedger(observations, energyLedgerWindow("RECENT_8_WEEKS", today))
  const used = ledger.rows.filter((row) => row.journalSessionCount > 0)
  if (used.length === 0) {
    return {
      id: "ENERGY_COVERAGE",
      title: "훈련 목적의 구성",
      headline: "직접 고른 에너지 시스템 기록이 아직 없어요",
      detail: "훈련 후 주된 목적을 고르면 8주 동안 어떤 유형을 얼마나 경험했는지 모아 보여드려요.",
      evidence: `최근 8주 반영 0건 · 제외 ${ledger.excludedSourceCount}건`,
    }
  }

  const maxCount = Math.max(...used.map((row) => row.journalSessionCount))
  const mostFrequent = used
    .filter((row) => row.journalSessionCount === maxCount)
    .map((row) => `${ENERGY_SYSTEM_META[row.key].code} ${ENERGY_SYSTEM_META[row.key].shortLabel}`)
    .join(" · ")
  return {
    id: "ENERGY_COVERAGE",
    title: "훈련 목적의 구성",
    headline: `최근 8주 ${used.length}가지 유형을 기록했어요`,
    detail: `가장 자주 고른 유형은 ${mostFrequent} ${maxCount}회예요. 자주 또는 적게 기록됐다는 사실이며, 강점·약점이나 부족 판정은 아니에요.`,
    evidence: `직접 선택 ${ledger.includedSourceCount}건 · 제외 ${ledger.excludedSourceCount}건 · 중복 ${ledger.duplicateSourceCount}건`,
  }
}

function planInsight(planState: PlanBetaState | null): PersonalOracleInsight {
  const plan = summarizeCurrentPlanEnergy(planState)
  if (plan === null) {
    return {
      id: "PLAN_FOLLOW_THROUGH",
      title: "계획과 실행 표시",
      headline: "진행 중인 계획이 아직 없어요",
      detail: "계획을 시작하면 예정한 훈련과 완료로 표시한 훈련을 분리해 보여드려요.",
      evidence: "저장된 계획 0개",
    }
  }
  return {
    id: "PLAN_FOLLOW_THROUGH",
    title: "계획과 실행 표시",
    headline: `예정 ${plan.plannedSessionCount}회 중 완료 표시 ${plan.completedMarkCount}회`,
    detail: "완료 표시는 실제 일지와 다른 기록이에요. 완료율이나 훈련 효과로 해석하지 않고, 계획을 어디까지 확인했는지만 보여드려요.",
    evidence: `휴식일 제외 ${plan.excludedRestDayCount}일 · 계획 진행 표시 기준`,
  }
}

export function derivePersonalOracle({
  observations,
  today,
  planState,
}: PersonalOracleInput): PersonalOracleExplanation {
  const startDate = isoShift(today, -55)
  const acceptedSessions = recentAcceptedSessions(observations, startDate, today)
  const structuredSourceCount = acceptedSessions.length
  const maturity: PersonalOracleMaturity = structuredSourceCount === 0 && planState === null
    ? "EMPTY"
    : structuredSourceCount < 4
      ? "STARTING"
      : "DESCRIPTIVE"

  const summary = maturity === "EMPTY"
    ? "아직 단정할 수 있는 흐름은 없어요. 첫 기록부터 근거가 시작됩니다."
    : maturity === "STARTING"
      ? "기록이 시작됐어요. 지금은 보이는 사실만 짧게 정리합니다."
      : "최근 기록에서 확인되는 거리·훈련 목적·계획 진행을 나눠 정리했습니다."

  return {
    version: PERSONAL_ORACLE_VERSION,
    maturity,
    summary,
    insights: [
      distanceInsight(observations, today),
      energyInsight(observations, today),
      planInsight(planState),
    ],
    knownFacts: [
      "직접 적고 출처가 확인된 구조화 기록만 계산했습니다.",
      "계획의 예정값, 완료 표시, 실제 일지값을 서로 섞지 않았습니다.",
    ],
    unknowns: [
      "이 기록만으로 경기력 향상, 적정 훈련량, 몸 상태를 판단할 수 없습니다.",
      "비밀 메모 원문과 메모가 있다는 사실은 읽거나 분석에 쓰지 않습니다.",
      "이 설명은 다음 계획의 강도·양·빈도를 자동으로 올리거나 내리지 않습니다.",
    ],
    structuredSourceCount,
  }
}
