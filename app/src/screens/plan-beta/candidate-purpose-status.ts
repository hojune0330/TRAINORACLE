import { assertNever } from "@impl/shared/assert-never"
import type { PlanCandidateKind } from "@impl/plan-generator/types"

export type CandidatePurposeStatus = {
  readonly tone: "included" | "conservative"
  readonly label: string
  readonly detail: string
}

export function candidatePurposeStatus(kind: PlanCandidateKind): CandidatePurposeStatus {
  switch (kind) {
    case "BALANCED":
      return {
        tone: "included",
        label: "쉬운 훈련 시간을 범위로 표시해요.",
        detail: "각 날에 표시된 최소~최대 시간 안에서 직접 정해요.",
      }
    case "CONSERVATIVE":
      return {
        tone: "conservative",
        label: "쉬운 훈련을 가장 짧은 시간으로 표시해요.",
        detail: "조정할 수 있는 날은 최소~최대 시간 중 가장 짧은 값으로 미리 정해요.",
      }
    default:
      return assertNever(kind)
  }
}
