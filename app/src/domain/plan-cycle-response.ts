import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanSession } from "@impl/plan-generator/types"
import { FIELD_PROVENANCE } from "./field-provenance"
import type { JournalEntry } from "./journal-schema"
import type { PlanBetaState } from "./plan-beta-schema"

export const PLAN_CYCLE_RESPONSE_VERSION = "PLAN_CYCLE_RESPONSE_V1" as const

export type PlanCycleResponse = {
  readonly version: typeof PLAN_CYCLE_RESPONSE_VERSION
  readonly signal: "NO_LINKED_RESULTS" | "ONE_SIGNAL" | "REPEATED_MATCH" | "REPEATED_HIGHER_EFFORT" | "MIXED_SIGNAL"
  readonly recommendation: "MAINTAIN" | "MAINTAIN_OR_VARY_METHOD" | "REDUCE_OR_REVIEW" | "MAINTAIN_AND_REVIEW"
  readonly headline: string
  readonly linkedResultCount: number
  readonly comparableRpeCount: number
  readonly withinRangeCount: number
  readonly higherThanRangeCount: number
  readonly unknownCount: number
  readonly evidence: readonly string[]
}

function activeCandidateFingerprint(state: PlanBetaState): string {
  return canonicalJsonFingerprint(
    "trainoracle.plan-candidate-reference.v1",
    state.activePlan.candidateId,
  )
}

function sessionForLink(state: PlanBetaState, entry: Extract<JournalEntry, { readonly kind: "post-session" }>): PlanSession | null {
  const link = entry.plannedSessionLink
  if (link === undefined || link.candidateFingerprint !== activeCandidateFingerprint(state)) return null
  return state.activePlan.sessions.find((session) => (
    session.day === link.sessionDay
    && session.slot === link.sessionSlot
    && session.role === link.plannedRole
    && session.plannedEnergyIntent === link.plannedEnergyIntent
  )) ?? null
}

export function derivePlanCycleResponse(
  entries: readonly JournalEntry[],
  state: PlanBetaState,
): PlanCycleResponse {
  const linked = entries.flatMap((entry) => {
    if (entry.kind !== "post-session") return []
    const session = sessionForLink(state, entry)
    return session === null ? [] : [{ entry, session }]
  })
  let comparableRpeCount = 0
  let withinRangeCount = 0
  let higherThanRangeCount = 0
  let unknownCount = 0

  for (const { entry, session } of linked) {
    if (session.prescription.kind !== "RPE_TIME_RANGE"
      || entry.rpe < 1
      || entry.rpe > 10
      || entry.fieldProvenance?.rpe?.provenance !== FIELD_PROVENANCE.explicit) {
      unknownCount += 1
      continue
    }
    comparableRpeCount += 1
    if (entry.rpe >= session.prescription.rpe.minimum && entry.rpe <= session.prescription.rpe.maximum) {
      withinRangeCount += 1
    } else if (entry.rpe > session.prescription.rpe.maximum) {
      higherThanRangeCount += 1
    }
  }

  const signal: PlanCycleResponse["signal"] = linked.length === 0
    ? "NO_LINKED_RESULTS"
    : comparableRpeCount < 2
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
    ONE_SIGNAL: "한 번의 기록만 있어 현재 수준을 유지해요",
    REPEATED_MATCH: "반복 기록이 계획 RPE 범위와 맞았어요",
    REPEATED_HIGHER_EFFORT: "반복 기록의 RPE가 계획보다 높았어요",
    MIXED_SIGNAL: "기록마다 RPE 흐름이 달라요",
  }

  return {
    version: PLAN_CYCLE_RESPONSE_VERSION,
    signal,
    recommendation,
    headline: headline[signal],
    linkedResultCount: linked.length,
    comparableRpeCount,
    withinRangeCount,
    higherThanRangeCount,
    unknownCount,
    evidence: [
      `현재 계획에서 이어 쓴 일지 ${linked.length}건`,
      `직접 입력 RPE 비교 ${comparableRpeCount}건`,
      `계획 범위 안 ${withinRangeCount}건 · 범위보다 높음 ${higherThanRangeCount}건 · 비교 불가 ${unknownCount}건`,
    ],
  }
}
