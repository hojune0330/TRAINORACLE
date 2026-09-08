import React from "react"
import { Upload } from "lucide-react"
import { migrateOwnedAccountJournals } from "../../domain/account/account-journal-record-service"
import { activeLocalAccount } from "../../domain/account/local-journal-ownership"
import { secondaryBtn } from "./styles"

export function AccountJournalMigration({ userId }: { readonly userId: string }) {
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [consent, setConsent] = React.useState(false)
  const transfer = async () => {
    if (!consent || busy || userId !== activeLocalAccount()) return
    setBusy(true)
    const result = await migrateOwnedAccountJournals()
    if (userId !== activeLocalAccount()) return
    setMessage(`${result.saved}개 계정 저장 확인 · ${result.pending}개 전송 대기 · ${result.attention}개 확인 필요.${result.ok ? "" : " 모두 처리하지 못했어요. 다시 시도해 주세요."} 기기의 원본은 삭제하지 않았어요.`)
    setBusy(false)
  }
  return <section style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
    <h2 style={{ fontSize: 18 }}>기존 일지를 계정에 보관</h2>
    <p>위에서 내 계정에 연결한 기기 일지만 옮겨요. 메모도 암호화해 보관하며, 비밀 메모는 공유·분석에 쓰지 않아요. 이전 금고의 글은 먼저 복구 코드로 열어 주세요.</p>
    <label style={{ display: "flex", gap: 8, minHeight: 44, alignItems: "center" }}><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />연결된 일지와 메모를 이 계정에 보관할게요</label>
    <button type="button" disabled={busy || !consent} style={secondaryBtn} onClick={() => void transfer()}><Upload size={16} aria-hidden="true" />계정에 보관하기</button>
    {message && <p role="status">{message}</p>}
  </section>
}
