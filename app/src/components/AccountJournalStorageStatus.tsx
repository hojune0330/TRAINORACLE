import React from "react"
import { RefreshCw } from "lucide-react"
import { accountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { hydrateAccountJournalRecords, listAccountJournalRecoveryRecords } from "../domain/account/account-journal-record-service"
import { AccountJournalConflictResolver } from "./AccountJournalConflictResolver"

export function AccountJournalStorageStatus() {
  const [reviewOpened, setReviewOpened] = React.useState(false)
  const [hasArchive, setHasArchive] = React.useState(false)
  const status = React.useSyncExternalStore(callback => {
    window.addEventListener("trainoracle:account-journals-changed", callback)
    return () => window.removeEventListener("trainoracle:account-journals-changed", callback)
  }, accountJournalProjectionStatus, () => "IDLE")
  React.useEffect(() => {
    if (status === "CONFLICT") setReviewOpened(true)
    if (status === "IDLE") setReviewOpened(false)
  }, [status])
  React.useEffect(() => {
    let active = true
    if (status === "IDLE") { setHasArchive(false); return }
    void listAccountJournalRecoveryRecords().then(items => { if (active) setHasArchive(items.length > 0) })
      .catch(() => { if (active) setHasArchive(false) })
    return () => { active = false }
  }, [status])
  if (status !== "LOADING" && status !== "PENDING" && status !== "REJECTED" && status !== "FAILED" && status !== "CONFLICT" && !reviewOpened && !hasArchive) return null
  return <div style={{ padding: "4px 12px", fontSize: 13, background: "var(--paper)", color: "var(--ink)" }}>
    {status === "LOADING" ? "계정의 일지를 불러오고 있어요." : status === "PENDING"
      ? "기기에 보관한 기록의 계정 저장을 확인하고 있어요. 미확인 입력은 통계에 반영하지 않았어요." : status === "REJECTED"
      ? "서버가 기록 저장을 명시적으로 거절했어요. 저장 완료가 아니며 미확인 입력은 통계에 반영하지 않았어요. 입력은 이 계정의 암호화된 기기 보관본에 남아 있고 자동 재전송은 중지했어요. 이미 기록된 계획 회차, 포인트 부족 또는 이전 요청 결과 확인 불가로 거절될 수 있어요. 기존 계정 기록과 포인트를 먼저 확인해 주세요. 이 안내에서는 보관본을 삭제하거나 새 요청으로 다시 제출하지 않아요." : status === "CONFLICT"
      ? "다른 기기의 수정·삭제와 겹친 일지가 있어요. 기기의 수정본은 보존했어요. 최신 내용을 확인해 주세요."
      : status === "FAILED" ? "계정 일지를 모두 불러오지 못했어요. 기존 내용은 보존했어요." : null}
    {status === "FAILED" && <button type="button" aria-label="계정 일지 다시 불러오기" title="계정 일지 다시 불러오기" style={{ minWidth: 44, minHeight: 44 }} onClick={() => void hydrateAccountJournalRecords()}><RefreshCw size={16} /></button>}
    {(status === "CONFLICT" || reviewOpened || hasArchive) && <AccountJournalConflictResolver />}
  </div>
}
