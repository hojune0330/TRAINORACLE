import { assertNever } from "@impl/shared/assert-never"
import type { PlanCandidateKind } from "@impl/plan-generator/types"

export type CandidatePurposeStatus = {
  readonly tone: "included" | "conservative"
  readonly label: string
  readonly detail: string
}

export function candidatePurposeStatus(kind: PlanCandidateKind, hasCatalog = false): CandidatePurposeStatus {
  if (hasCatalog) return { tone: kind === "BALANCED" ? "included" : "conservative",
    label: "운동별 시간 확인",
    detail: "훈련 방법과 시간은 날짜별 일정에 표시돼요" }
  switch (kind) {
    case "BALANCED":
      return {
        tone: "included",
        label: "운동별 시간 확인",
        detail: "범위가 있으면 그 안에서 시간을 정해요",
      }
    case "CONSERVATIVE":
      return {
        tone: "conservative",
        label: "운동별 시간 확인",
        detail: "범위가 있으면 그 안에서 시간을 정해요",
      }
    default:
      return assertNever(kind)
  }
}
