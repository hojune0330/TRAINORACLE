import React from "react"
import { RefreshCw } from "lucide-react"
import { accountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { hydrateAccountJournalRecords } from "../domain/account/account-journal-record-service"

export function AccountJournalStorageStatus() {
  const status = React.useSyncExternalStore(callback => {
    window.addEventListener("trainoracle:account-journals-changed", callback)
    return () => window.removeEventListener("trainoracle:account-journals-changed", callback)
  }, accountJournalProjectionStatus, () => "IDLE")
  if (status !== "LOADING" && status !== "FAILED" && status !== "CONFLICT") return null
  return <div role="status" style={{ padding: "4px 12px", fontSize: 13, background: "var(--paper)", color: "var(--ink)" }}>
    {status === "LOADING" ? "계정의 일지를 불러오고 있어요." : status === "CONFLICT"
      ? "다른 기기의 수정·삭제와 겹친 일지가 있어요. 두 내용을 보존했고 자동으로 덮어쓰지 않았어요."
      : "계정 일지를 모두 불러오지 못했어요. 기존 내용은 보존했어요."}
    {status === "FAILED" && <button type="button" aria-label="계정 일지 다시 불러오기" title="계정 일지 다시 불러오기" style={{ minWidth: 44, minHeight: 44 }} onClick={() => void hydrateAccountJournalRecords()}><RefreshCw size={16} /></button>}
  </div>
}
