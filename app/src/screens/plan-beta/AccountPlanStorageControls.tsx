import { RefreshCw } from "lucide-react"
import type { AccountPlanStatus } from "../../domain/account/account-plan-service"

const labels: Record<AccountPlanStatus, string> = {
  IDLE: "계정 저장 확인 전", LOADING: "계획 불러오는 중", EMPTY: "저장된 계획 없음", READY: "계정에 저장됨", PENDING: "연결 대기",
  CONFLICT: "충돌 확인 필요", FAILED: "계획 조회·저장 실패", AUTH_REQUIRED: "로그인 필요", INVALID: "계획 형식 확인 필요", REJECTED: "계정 저장 거절됨",
}
export function AccountPlanStorageControls({ status, evidenceRequired = false, onRetry, onUseServer, capacity }: {
  status: AccountPlanStatus; evidenceRequired?: boolean; onRetry: () => void; onUseServer?: () => void;
  capacity?: { bytes: number; limit: number; plans: number };
}) {
  return <section aria-label="계획 계정 보관">
    <p role="status">{labels[status]}</p>
    {capacity && <p>계획 보관 {capacity.plans}개 · {Math.ceil(capacity.bytes / 1000)} / {capacity.limit / 1000} kB
      {capacity.bytes >= capacity.limit * 0.9 ? " · 남은 공간이 적어요. 기존 원본은 자동 삭제하지 않아요." : ""}</p>}
    {evidenceRequired && <p role="alert">저장한 계획과 진행 기록은 읽을 수 있어요. 현재 훈련을 시작하는 데 필요한 조건과 근거는 아직 확인되지 않아 원본만 표시해요.</p>}
    {status === "REJECTED" && <p role="alert">서버가 이 저장 요청을 받아들이지 않았어요. 기기 원본과 저장 요청은 삭제하지 않았으며, 계정에 저장된 것으로 표시하지 않아요.</p>}
    {status === "CONFLICT" && <>
      <p>기기 수정본과 서버 계획을 모두 보존했어요. 서버 계획을 선택해도 기기 충돌본은 삭제하지 않아요.</p>
      {onUseServer && <button type="button" onClick={onUseServer}>기기 수정본 보존하고 서버 계획 보기</button>}
    </>}
    {["FAILED", "PENDING", "AUTH_REQUIRED"].includes(status) &&
      <button type="button" className="btn btn-secondary" aria-label="계획 저장 다시 확인" title="계획 저장 다시 확인" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" /> 다시 확인
      </button>}
  </section>
}
