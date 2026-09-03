import type { PlanSession } from "@impl/plan-generator/types"
import { buildSessionExplanationContent, type SessionExplanationContext } from "./session-explanation-content"
import { hasMatchingExplanationReceipt } from "./training-explanation-receipt"

export { explanationProfile, secondsText } from "./session-explanation-content"
export type { SessionExplanationContext, ExplainedComponent } from "./session-explanation-content"

export function explainSession(session: PlanSession, context?: SessionExplanationContext) {
  const content = buildSessionExplanationContent(session, context)
  const usableContext = content.contextMatchesSession ? context : undefined
  const originalExplanationAvailable = usableContext?.kind === "CANDIDATE"
    || (usableContext?.kind === "SAVED" && usableContext.generatedAt !== undefined
      && hasMatchingExplanationReceipt(usableContext.plan, usableContext.generatedAt, usableContext.receipt))
  const availability = originalExplanationAvailable
    ? usableContext?.kind === "CANDIDATE" ? "선택 전 계획의 구성 설명" : "저장된 처방과 설명 버전이 일치해요."
    : "저장 당시의 설명은 없거나 버전이 달라요. 아래는 현재 처방에 적힌 구성과 공통 원리이며, 과거 선택 이유를 복원한 것은 아니에요."
  const currentFrameLabel = usableContext?.frameOrdinal === undefined ? null
    : `현재 장기 계획의 ${usableContext.frameOrdinal}번째 주기에 연결되어 있어요. 저장 당시의 설명과 별도로 현재 연결 상태를 표시하며, 순번만으로 적응 완료를 판정하지 않아요.`
  return { ...content, originalExplanationAvailable, availability, currentFrameLabel }
}
