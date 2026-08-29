import { buildEnergySystemLedger, energyLedgerWindow } from "./energy-system-ledger"
import { ENERGY_SYSTEM_META } from "./energy-system-taxonomy"
import type { EnergySystemKey } from "./energy-system-taxonomy"
import type { StructuredJournalObservation } from "./journal-observation"
import type { PlanBetaState } from "./plan-beta-schema"
import type { TrainingContentArticle } from "./training-content-catalog"

export const TRAINING_METHOD_COMPATIBILITY_VERSION = "TRAINING_METHOD_COMPATIBILITY_V1" as const

export type TrainingMethodCompatibilityStatus =
  | "CONTEXT_MATCH"
  | "PARTIAL_MATCH"
  | "CONTEXT_MISMATCH"
  | "NOT_ENOUGH_DATA"

export type TrainingMethodCompatibility = {
  readonly version: typeof TRAINING_METHOD_COMPATIBILITY_VERSION
  readonly status: TrainingMethodCompatibilityStatus
  readonly dataSufficiency: "EMPTY" | "PARTIAL" | "ENOUGH"
  readonly headline: string
  readonly supports: readonly string[]
  readonly conflicts: readonly string[]
  readonly unknowns: readonly string[]
  readonly evidence: readonly string[]
  readonly planEligibility: "NOT_PLAN_ELIGIBLE"
}

type CompatibilityInput = {
  readonly article: TrainingContentArticle
  readonly observations: readonly StructuredJournalObservation[]
  readonly planState: PlanBetaState | null
  readonly today: string
}

const STATUS_HEADLINE: Record<TrainingMethodCompatibilityStatus, string> = {
  CONTEXT_MATCH: "현재 설정과 비교할 만한 조건이 있어요",
  PARTIAL_MATCH: "맞는 조건과 확인할 조건이 함께 있어요",
  CONTEXT_MISMATCH: "현재 설정과 부딪히는 조건이 있어요",
  NOT_ENOUGH_DATA: "아직 비교할 기록과 계획이 부족해요",
}

function availableDayNumber(value: PlanBetaState["intake"]["availableDayCount"]): number {
  return value === "EVERY_DAY" ? 7 : value ?? 0
}

function requiredDayNumber(value: TrainingContentArticle["compatibility"]["minimumAvailableDays"]): number {
  return value === "EVERY_DAY" ? 7 : value
}

function systemLabel(key: EnergySystemKey): string {
  const meta = ENERGY_SYSTEM_META[key]
  return `${meta.code} ${meta.shortLabel}`
}

export function deriveTrainingMethodCompatibility({
  article,
  observations,
  planState,
  today,
}: CompatibilityInput): TrainingMethodCompatibility {
  const ledger = buildEnergySystemLedger(observations, energyLedgerWindow("RECENT_8_WEEKS", today))
  const supports: string[] = []
  const conflicts: string[] = []
  const unknowns: string[] = []
  const evidence: string[] = []
  const intake = planState?.intake

  if (intake === undefined || intake.eventDistanceM === undefined) {
    unknowns.push("진행 중인 계획의 목표 종목이 없어 종목 조건을 비교하지 못했어요.")
  } else if (article.compatibility.suitableEventDistancesM.some((distance) => distance === intake.eventDistanceM)) {
    supports.push(`${intake.eventDistanceM}m 목표는 이 자료가 다루는 종목 범위에 들어요.`)
    evidence.push(`현재 계획 종목 ${intake.eventDistanceM}m`)
  } else {
    conflicts.push(`${intake.eventDistanceM}m 목표는 이 자료의 적용 사례 범위와 달라요.`)
    evidence.push(`현재 계획 종목 ${intake.eventDistanceM}m · 자료 범위 불일치`)
  }

  if (intake?.experienceBand === undefined) {
    unknowns.push("훈련 경험 설정이 없어 경험 조건을 비교하지 못했어요.")
  } else if (article.compatibility.suitableExperienceBands.includes(intake.experienceBand)) {
    supports.push("현재 훈련 경험 설정은 이 자료를 이해하고 비교할 범위에 들어요.")
    evidence.push(`경험 설정 ${intake.experienceBand}`)
  } else {
    conflicts.push("현재 훈련 경험 설정에서는 이 방법을 그대로 따라 하지 않는 편이 좋아요.")
    evidence.push(`경험 설정 ${intake.experienceBand} · 자료 범위 불일치`)
  }

  const availableDays = intake?.availableDayCount === undefined ? 0 : availableDayNumber(intake.availableDayCount)
  const requiredDays = requiredDayNumber(article.compatibility.minimumAvailableDays)
  if (availableDays === 0) {
    unknowns.push("한 주기에 훈련 가능한 날 설정이 없어 일정 조건을 비교하지 못했어요.")
  } else if (availableDays >= requiredDays) {
    supports.push(`훈련 가능일 ${availableDays}일은 이 방법을 검토할 최소 일정 조건을 충족해요.`)
    evidence.push(`훈련 가능일 ${availableDays}일`)
  } else {
    conflicts.push(`현재 훈련 가능일 ${availableDays}일은 이 방법의 구성에 필요한 ${requiredDays}일보다 적어요.`)
    evidence.push(`훈련 가능일 ${availableDays}일 · 참고 최소 ${requiredDays}일`)
  }

  if (article.compatibility.requiresTwoQualitySessionsSameDay) {
    conflicts.push("현재 TrainOracle은 같은 날 주요 훈련 두 번을 자동 계획으로 만들지 않아요.")
    evidence.push("하루 두 번 주요 훈련 자동 처방 비활성")
  }

  const targetRows = ledger.rows.filter((row) => article.compatibility.targetEnergySystems.includes(row.key))
  const targetCount = targetRows.reduce((sum, row) => sum + row.journalSessionCount, 0)
  if (ledger.includedSourceCount === 0) {
    unknowns.push("최근 8주에 직접 선택한 에너지 시스템 기록이 없어 반복 여부를 확인하지 못했어요.")
  } else {
    const labels = targetRows.map((row) => systemLabel(row.key)).join(" · ")
    supports.push(`최근 8주 ${labels} 기록은 ${targetCount}회예요. 사용 빈도를 확인할 근거가 생겼어요.`)
    evidence.push(`최근 8주 직접 선택 기록 ${ledger.includedSourceCount}건 · 대상 시스템 ${targetCount}회`)
    const highest = Math.max(...ledger.rows.map((row) => row.journalSessionCount))
    if (targetCount > 0 && targetRows.some((row) => row.journalSessionCount === highest) && highest >= 3) {
      conflicts.push("최근 기록에서 같은 목적이 가장 자주 나타났어요. 새로 더하기보다 반복 사용 여부를 먼저 확인하세요.")
    }
  }

  const dataSufficiency = planState === null && ledger.includedSourceCount === 0
    ? "EMPTY"
    : planState === null || ledger.includedSourceCount < 3
      ? "PARTIAL"
      : "ENOUGH"
  const status: TrainingMethodCompatibilityStatus = conflicts.length >= 2
    ? "CONTEXT_MISMATCH"
    : conflicts.length === 1 || unknowns.length > 0
      ? supports.length > 0 ? "PARTIAL_MATCH" : "NOT_ENOUGH_DATA"
      : supports.length > 0
        ? "CONTEXT_MATCH"
        : "NOT_ENOUGH_DATA"

  return {
    version: TRAINING_METHOD_COMPATIBILITY_VERSION,
    status,
    dataSufficiency,
    headline: STATUS_HEADLINE[status],
    supports,
    conflicts,
    unknowns,
    evidence,
    planEligibility: "NOT_PLAN_ELIGIBLE",
  }
}
