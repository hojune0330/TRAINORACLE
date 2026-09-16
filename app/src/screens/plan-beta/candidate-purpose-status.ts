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
        label: "쉬운 날은 시간 범위로",
        detail: "그날 컨디션에 맞춰 범위 안에서",
      }
    case "CONSERVATIVE":
      return {
        tone: "conservative",
        label: "쉬운 날은 가장 짧게",
        detail: "바쁠 때 좋아요",
      }
    default:
      return assertNever(kind)
  }
}
