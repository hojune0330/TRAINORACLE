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
        label: "고른 목적을 이 계획에 넣었어요.",
        detail: "고른 목적에 맞춘 훈련과 가벼운 훈련을 함께 보여줘요.",
      }
    case "CONSERVATIVE":
      return {
        tone: "conservative",
        label: "고른 목적을 덜어 낸 대안이에요.",
        detail: "고른 목적의 집중 부분은 이번 주기에 넣지 않고, 더 보수적으로 구성해요.",
      }
    default:
      return assertNever(kind)
  }
}
