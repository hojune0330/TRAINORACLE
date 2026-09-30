import { RefreshCw } from "lucide-react"
import "./plan-evidence-history-notice.css"

export function PlanEvidenceHistoryNotice({ status, onRetry }: {
  readonly status: "ready" | "loading" | "unavailable" | "account-unavailable"
  readonly onRetry: () => void
}) {
  if (status === "ready") return null
  return <div className="plan-evidence-history-notice" role="status">
    <p>{status === "loading" ? "이전 계획과 연결된 기록을 확인하고 있어요."
      : status === "account-unavailable" ? "계정의 계획을 불러오지 못했어요. 계획 화면에서 계정 연결과 저장 상태를 먼저 확인해 주세요."
      : "이전 계획을 불러오지 못했어요. 확인된 기록은 그대로 보여드려요."}</p>
    {status === "unavailable" && <button type="button" onClick={onRetry}>
      <RefreshCw size={16} aria-hidden="true" /> 이전 계획 다시 불러오기
    </button>}
  </div>
}
