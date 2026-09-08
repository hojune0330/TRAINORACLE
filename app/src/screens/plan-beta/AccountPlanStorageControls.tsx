import { RefreshCw, X } from "lucide-react"
import type { AccountPlanStatus } from "../../domain/account/account-plan-service"
import "./AccountPlanStorage.css"

const labels: Record<AccountPlanStatus, string> = {
  IDLE: "계정 저장 확인 전", LOADING: "계획 불러오는 중", EMPTY: "저장된 계획 없음", READY: "계정에 저장됨", PENDING: "연결 대기",
  CONFLICT: "충돌 확인 필요", FAILED: "계획 조회·저장 실패", AUTH_REQUIRED: "로그인 필요", INVALID: "계획 형식 확인 필요", REJECTED: "계정 저장 거절됨",
}

export function AccountPlanHistoryControls({ status, progress, onRetry, onCancel }: {
  status: "IDLE" | "LOADING" | "READY" | "FAILED";
  progress?: { loaded: number; total: number };
  onRetry: () => void;
  onCancel?: () => void;
}) {
  if (status === "READY") return null
  return <div className="account-plan-history-controls">
    <p role={status === "FAILED" ? "alert" : "status"}>
      {status === "FAILED" ? "과거 계획을 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요."
        : status === "LOADING" ? `과거 계획 불러오는 중${progress ? ` (${progress.loaded}/${progress.total})` : ""}` : "과거 계획 확인 대기"}
    </p>
    {status === "LOADING" ? onCancel && <button type="button" onClick={onCancel}>
      <X size={16} aria-hidden="true" /> 불러오기 취소
    </button> : <button type="button" onClick={onRetry}>
      <RefreshCw size={16} aria-hidden="true" /> {status === "FAILED" ? "과거 계획 다시 불러오기" : "과거 계획 불러오기"}
    </button>}
  </div>
}
export function AccountPlanStorageControls({ status, evidenceRequired = false, onRetry, onUseServer, capacity, collectionCount, retryAvailable = true }: {
  status: AccountPlanStatus; evidenceRequired?: boolean; onRetry: () => void; onUseServer?: () => void;
  capacity?: { bytes: number; limit: number; plans: number };
  collectionCount?: number;
  retryAvailable?: boolean;
}) {
  return <section className="account-plan-storage" aria-label="계획 계정 보관">
    <p role="status">{labels[status]}</p>
    {collectionCount !== undefined && <p>계정에 보관한 계획 {collectionCount}개 · 계획별로 나누어 안전하게 저장해요.</p>}
    {capacity && <p>계획 보관 {capacity.plans}개 · {Math.ceil(capacity.bytes / 1000)} / {capacity.limit / 1000} kB
      {capacity.bytes >= capacity.limit * 0.9 ? " · 남은 공간이 적어요. 기존 원본은 자동 삭제하지 않아요." : ""}</p>}
    {evidenceRequired && <p role="alert">저장한 계획과 진행 기록은 읽을 수 있어요. 현재 훈련을 시작하는 데 필요한 조건과 근거는 아직 확인되지 않아 원본만 표시해요.</p>}
    {status === "REJECTED" && <p role="alert">서버가 이 저장 요청을 받아들이지 않았어요. 기기 원본과 저장 요청은 삭제하지 않았으며, 계정에 저장된 것으로 표시하지 않아요.</p>}
    {status === "CONFLICT" && <>
      <p>기기 수정본과 서버 계획을 모두 보존했어요. 서버 계획을 선택해도 기기 충돌본은 삭제하지 않아요.</p>
      {onUseServer && <button type="button" onClick={onUseServer}>기기 수정본 보존하고 서버 계획 보기</button>}
    </>}
    {retryAvailable && ["FAILED", "PENDING", "AUTH_REQUIRED"].includes(status) &&
      <button type="button" className="btn btn-secondary" aria-label="계획 저장 다시 확인" title="계획 저장 다시 확인" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" /> 다시 확인
      </button>}
  </section>
}
