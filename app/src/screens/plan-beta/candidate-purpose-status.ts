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
        label: "고른 목적을 표준 용량으로 넣었어요.",
        detail: "고른 목적은 유지하고, 집중 훈련과 가벼운 훈련을 표준 구성으로 보여줘요.",
      }
    case "CONSERVATIVE":
      return {
        tone: "conservative",
        label: "같은 목적을 더 낮은 부담으로 넣었어요.",
        detail: "고른 목적은 유지하고, 훈련량을 줄이거나 회복 여유를 더 둬요.",
      }
    default:
      return assertNever(kind)
  }
}
