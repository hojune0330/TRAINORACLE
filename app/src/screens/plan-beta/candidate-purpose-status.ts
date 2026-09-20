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
        label: "기초·회복 운동은 시간 범위로",
        detail: "주요 훈련 횟수와 강도를 더 올리는 안은 아니에요",
      }
    case "CONSERVATIVE":
      return {
        tone: "conservative",
        label: "기초·회복 운동은 범위의 짧은 시간으로",
        detail: "주요 훈련의 횟수와 강도는 같은 기준을 사용해요",
      }
    default:
      return assertNever(kind)
  }
}
