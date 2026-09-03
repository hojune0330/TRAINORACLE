import type { JournalEntry } from "./journal-schema"
import type { PlanBetaState } from "./plan-beta-schema"
import { collectPlanJournalEvidence, type PlanJournalEvidenceRow } from "./plan-journal-evidence"

export const PLAN_CYCLE_RESPONSE_VERSION = "PLAN_CYCLE_RESPONSE_V2" as const

export type PlanCycleResponse = {
  readonly version: typeof PLAN_CYCLE_RESPONSE_VERSION
  readonly signal: "NO_LINKED_RESULTS" | "NO_COMPARABLE_RESULTS" | "ONE_SIGNAL" | "REPEATED_MATCH" | "REPEATED_HIGHER_EFFORT" | "MIXED_SIGNAL"
  readonly recommendation: "MAINTAIN" | "MAINTAIN_OR_VARY_METHOD" | "REDUCE_OR_REVIEW" | "MAINTAIN_AND_REVIEW"
  readonly headline: string
  readonly linkedResultCount: number
  readonly comparableRpeCount: number
  readonly withinRangeCount: number
  readonly higherThanRangeCount: number
  readonly lowerThanRangeCount: number
  readonly unknownCount: number
  readonly rows: readonly PlanJournalEvidenceRow[]
  readonly rejectedLinkCount: number
  readonly duplicateCount: number
  readonly conflictCount: number
  readonly evidence: readonly string[]
}

export function derivePlanCycleResponse(
  entries: readonly JournalEntry[],
  state: PlanBetaState,
): PlanCycleResponse {
  const evidence = collectPlanJournalEvidence(entries, state)
  const withinRangeCount = evidence.rows.filter(row => row.comparison === "WITHIN_RANGE").length
  const higherThanRangeCount = evidence.rows.filter(row => row.comparison === "ABOVE_RANGE").length
  const lowerThanRangeCount = evidence.rows.filter(row => row.comparison === "BELOW_RANGE").length
  const comparableRpeCount = withinRangeCount + higherThanRangeCount + lowerThanRangeCount
  const unknownCount = evidence.rows.length - comparableRpeCount

  const signal: PlanCycleResponse["signal"] = evidence.rows.length === 0
    ? "NO_LINKED_RESULTS"
    : comparableRpeCount === 0
      ? "NO_COMPARABLE_RESULTS"
      : comparableRpeCount === 1
        ? "ONE_SIGNAL"
        : higherThanRangeCount >= 2
          ? "REPEATED_HIGHER_EFFORT"
          : withinRangeCount === comparableRpeCount
            ? "REPEATED_MATCH"
            : "MIXED_SIGNAL"
  const recommendation: PlanCycleResponse["recommendation"] = signal === "REPEATED_MATCH"
    ? "MAINTAIN_OR_VARY_METHOD"
    : signal === "REPEATED_HIGHER_EFFORT"
      ? "REDUCE_OR_REVIEW"
      : signal === "MIXED_SIGNAL"
        ? "MAINTAIN_AND_REVIEW"
        : "MAINTAIN"
  const headline: Record<PlanCycleResponse["signal"], string> = {
    NO_LINKED_RESULTS: "계획에서 이어 쓴 일지가 아직 없어요",
    NO_COMPARABLE_RESULTS: "연결된 일지는 있지만 계획 RPE와 비교할 기록은 없어요",
    ONE_SIGNAL: "계획 RPE와 비교할 수 있는 기록은 1건이에요",
    REPEATED_MATCH: "반복 기록이 계획 RPE 범위와 맞았어요",
    REPEATED_HIGHER_EFFORT: "반복 기록의 RPE가 계획보다 높았어요",
    MIXED_SIGNAL: "각 훈련의 계획 RPE와 실제 느낌에 차이가 있어요",
  }

  return {
    version: PLAN_CYCLE_RESPONSE_VERSION,
    signal,
    recommendation,
    headline: headline[signal],
    linkedResultCount: evidence.rows.length,
    comparableRpeCount,
    withinRangeCount,
    higherThanRangeCount,
    lowerThanRangeCount,
    unknownCount,
    rows: evidence.rows,
    rejectedLinkCount: evidence.rejectedLinkCount,
    duplicateCount: evidence.duplicateCount,
    conflictCount: evidence.conflictCount,
    evidence: [
      `현재 계획에 연결된 훈련 ${evidence.rows.length}건`,
      `직접 입력 RPE 비교 ${comparableRpeCount}건`,
      `계획 범위 안 ${withinRangeCount}건 · 높음 ${higherThanRangeCount}건 · 낮음 ${lowerThanRangeCount}건 · 비교 불가 ${unknownCount}건`,
      ...(evidence.rejectedLinkCount > 0 ? [`현재 계획·날짜와 연결이 맞지 않아 제외 ${evidence.rejectedLinkCount}건`] : []),
      ...(evidence.duplicateCount > 0 ? [`같은 기록의 중복 사본 제외 ${evidence.duplicateCount}건`] : []),
      ...(evidence.conflictCount > 0 ? [`서로 다른 기록이 겹쳐 비교하지 않은 훈련 ${evidence.conflictCount}건`] : []),
    ],
  }
}
