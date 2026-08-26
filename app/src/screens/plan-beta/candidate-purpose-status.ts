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
        label: "보조 훈련 시간 범위를 그대로 보여줘요.",
        detail: "고강도 훈련과 훈련 횟수는 후보 B와 같고, 보조 훈련 시간 범위는 현재 상한을 유지해요.",
      }
    case "CONSERVATIVE":
      return {
        tone: "conservative",
        label: "보조 훈련 시간만 짧게 보여줘요.",
        detail: "고강도 훈련과 훈련 횟수는 후보 A와 같고, 적용 가능한 보조 훈련 시간만 범위의 최솟값으로 줄여요.",
      }
    default:
      return assertNever(kind)
  }
}
