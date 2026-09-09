import { useEffect, useRef, useState } from "react"
import { Archive, RefreshCw } from "lucide-react"
import type { AccountPlanCollectionService } from "../../domain/account/account-plan-collection-service"
import { AccountPlanHistoricalView } from "./AccountPlanHistoricalView"
import "./AccountPlanStorage.css"

export function AccountPlanLegacyRecovery({ service, view }: {
  service: AccountPlanCollectionService; view: ReturnType<AccountPlanCollectionService["snapshot"]>;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null)
  const generation = useRef(0), working = useRef(false)
  useEffect(() => {
    generation.current++; working.current = false; setBusy(false); setMessage(null)
    return () => { generation.current++ }
  }, [service])
  async function recover(choice?: "SERVER" | "HISTORY") {
    if (working.current) return
    const epoch = generation.current
    working.current = true; setBusy(true); setMessage(null)
    try {
      // A transport retry must not invent fresh training-selection authority.
      const result = await service.recoverLegacyPending(() => false, choice)
      if (epoch !== generation.current || service.snapshot().status === "IDLE") return
      setMessage(result === "ACCOUNT" ? "기존 자료를 보존하고 계정 상태를 다시 확인했어요."
        : result === "HISTORY_CONFLICT" ? "같은 계획의 진행 기록이 계정과 달라요. 어느 쪽도 덮어쓰지 않았어요. 기기 대기본을 남기고 계정 계획을 볼 수 있어요."
          : result === "PENDING" || result === "REVIEW_REQUIRED" ? "아직 계정 저장이 끝나지 않았어요. 새 계획 선택을 자동 재개하지 않아요. 계획 원본으로 보관할 수 있어요."
            : "자료를 보존한 채 복구를 멈췄어요. 연결과 계정 상태를 확인한 뒤 다시 시도해 주세요.")
    } catch {
      if (epoch === generation.current && service.snapshot().status !== "IDLE") setMessage("복구하지 못했어요. 기존 대기본은 삭제하지 않았어요.")
    } finally {
      if (epoch === generation.current) { working.current = false; setBusy(false) }
    }
  }
  return <section className="account-plan-legacy-recovery" aria-label="이전 저장 대기 계획 복구">
    <h2>아직 계정에 반영되지 않은 계획이 있어요</h2>
    <p>이 기기의 이전 저장 방식에 계획 {view.legacyPendingCount}개가 남아 있어요. 새 계획을 쓰기 전에 이 자료부터 확인해 주세요.</p>
    <details><summary>저장 대기 원본 확인</summary>
      {view.legacyPendingPlans.map(plan => plan.packet
        ? <AccountPlanHistoricalView key={plan.planId} packet={plan.packet} verificationPending />
        : <p key={plan.planId}>이 원본을 표시하지 못했어요. 저장된 자료는 변경하지 않았어요.</p>)}
    </details>
    <p>‘계획 원본으로 보관’은 현재 훈련으로 선택하지 않고 계정의 과거 계획에 보관해요. 기기 원본도 그대로 남겨요.</p>
    <div className="account-plan-recovery-actions">
    <button type="button" disabled={busy} aria-busy={busy} onClick={() => { void recover("HISTORY") }}><Archive size={16} aria-hidden="true" />계획 원본으로 보관</button>
    <button type="button" disabled={busy} onClick={() => { void recover() }}><RefreshCw size={16} aria-hidden="true" />기존 저장 다시 확인</button>
    </div>
    {view.totalPlans > 0 && <>
      <p>계정 계획을 먼저 보면 기기의 대기본은 따로 보존해요. 이 선택만으로 대기본이 온라인에 복사되는 것은 아니에요.</p>
      <button type="button" disabled={busy} onClick={() => { void recover("SERVER") }}>기기 대기본 남기고 계정 계획 보기</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>
}
